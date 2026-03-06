import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import { SESSION_COOKIE, setSessionCookie, clearSessionCookie } from "../lib/session";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  deleteSession,
  getSession,
} from "../lib/auth";
import { sendEmail } from "../lib/ses";
import { confirmationEmail, passwordResetEmail } from "../lib/emailTemplates";
import { getPrisma } from "../lib/prisma";
import SignupPage from "../components/auth/SignupPage";
import LoginPage from "../components/auth/LoginPage";
import ForgotPasswordPage from "../components/auth/ForgotPasswordPage";
import ResetPasswordPage from "../components/auth/ResetPasswordPage";
import DashboardPage from "../components/auth/DashboardPage";

const auth = new Hono<{ Bindings: CloudflareBindings }>();

// ── Sign up ──────────────────────────────────────────────────────────────────

auth.get("/signup", (c) => {
  const html = renderToString(<SignupPage />);
  return c.html(`<!DOCTYPE html>${html}`);
});

auth.post("/api/auth/signup", async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);

    const formData = await c.req.raw.formData();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");

    const renderError = (msg: string) => {
      const html = renderToString(
        <SignupPage error={msg} values={{ name, email }} />
      );
      return c.html(`<!DOCTYPE html>${html}`, 400);
    };

    if (!name) return renderError("Please enter your name.");
    if (!email || !email.includes("@")) return renderError("Please enter a valid email.");
    if (password.length < 8) return renderError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return renderError("Passwords do not match.");

    const existing = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return renderError("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const token = generateToken();
    const createdAt = new Date().toISOString();

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        confirmed: false,
        confirmationToken: token,
        createdAt,
      },
    });

    const confirmUrl = `${c.env.APP_URL}/api/auth/confirm?token=${token}`;

    if (c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY) {
      const { html: emailHtml, text: emailText } = confirmationEmail(confirmUrl);
      await sendEmail({
        to: email,
        subject: "Confirm your email — AI Together",
        htmlBody: emailHtml,
        textBody: emailText,
        fromEmail: c.env.SES_FROM_EMAIL,
        region: c.env.AWS_REGION,
        accessKeyId: c.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      });
    } else {
      console.log(`[dev] Confirmation URL for ${email}: ${confirmUrl}`);
    }

    return c.redirect("/login?check_email=1");
  } catch (err) {
    console.error("Auth signup error", err);
    const html = renderToString(
      <SignupPage error="Something went wrong. Please try again." />
    );
    return c.html(`<!DOCTYPE html>${html}`, 500);
  }
});

// ── Email confirmation ────────────────────────────────────────────────────────

auth.get("/api/auth/confirm", async (c) => {
  const token = c.req.query("token");

  if (!token) return c.redirect("/login?error=missing_token");

  const prisma = getPrisma(c.env.DB);

  const user = await prisma.user.findFirst({
    where: { confirmationToken: token },
    select: { id: true, confirmed: true },
  });

  if (!user) return c.redirect("/login?error=invalid_token");

  if (user.confirmed !== true) {
    await prisma.user.update({
      where: { id: user.id },
      data: { confirmed: true, confirmationToken: null },
    });
  }

  const sessionToken = await createSession(prisma, user.id);
  setSessionCookie(c, sessionToken);
  return c.redirect("/dashboard");
});

// ── Login ────────────────────────────────────────────────────────────────────

auth.get("/login", (c) => {
  const confirmed = c.req.query("confirmed") === "1";
  const checkEmail = c.req.query("check_email") === "1";
  const errorParam = c.req.query("error");

  let error: string | undefined;
  if (errorParam === "invalid_token") error = "This confirmation link is invalid or has already been used.";
  if (errorParam === "missing_token") error = "No confirmation token provided.";

  if (checkEmail) {
    const html = renderToString(
      <LoginPage
        confirmed={false}
        error="Account created! Check your inbox to confirm your email before signing in."
      />
    );
    return c.html(`<!DOCTYPE html>${html}`);
  }

  const html = renderToString(
    <LoginPage confirmed={confirmed} error={error} />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

auth.post("/api/auth/login", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const formData = await c.req.raw.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const renderError = (msg: string) => {
    const html = renderToString(
      <LoginPage error={msg} values={{ email }} />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  };

  if (!email || !password) return renderError("Please fill in all fields.");

  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      confirmed: true,
    },
  });

  if (!user) return renderError("Invalid email or password.");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return renderError("Invalid email or password.");

  if (user.confirmed !== true) {
    return renderError("Please confirm your email before signing in.");
  }

  const token = await createSession(prisma, user.id);
  setSessionCookie(c, token);
  return c.redirect("/dashboard");
});

// ── Logout ───────────────────────────────────────────────────────────────────

auth.post("/api/auth/logout", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await deleteSession(prisma, token);
  }
  clearSessionCookie(c);
  return c.redirect("/login");
});

// ── Dashboard ────────────────────────────────────────────────────────────────

auth.get("/dashboard", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");

  const user = await getSession(prisma, token);
  if (!user) {
    clearSessionCookie(c);
    return c.redirect("/login");
  }

  const html = renderToString(<DashboardPage user={user} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Forgot password ───────────────────────────────────────────────────────────

auth.get("/forgot-password", (c) => {
  const html = renderToString(<ForgotPasswordPage />);
  return c.html(`<!DOCTYPE html>${html}`);
});

auth.post("/api/auth/forgot-password", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const formData = await c.req.raw.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    const html = renderToString(
      <ForgotPasswordPage error="Please enter a valid email." />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  }

  const user = await prisma.user.findFirst({
    where: { email, confirmed: true },
    select: { id: true },
  });

  // Always show success to prevent email enumeration
  if (user) {
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires: expiresAt,
      },
    });

    const resetUrl = `${c.env.APP_URL}/reset-password?token=${resetToken}`;

    if (c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY) {
      const { html: emailHtml, text: emailText } = passwordResetEmail(resetUrl);
      await sendEmail({
        to: email,
        subject: "Reset your password — AI Together",
        htmlBody: emailHtml,
        textBody: emailText,
        fromEmail: c.env.SES_FROM_EMAIL,
        region: c.env.AWS_REGION,
        accessKeyId: c.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      });
    } else {
      console.log(`[dev] Password reset URL for ${email}: ${resetUrl}`);
    }
  }

  const html = renderToString(<ForgotPasswordPage sent={true} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Reset password ────────────────────────────────────────────────────────────

auth.get("/reset-password", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    const html = renderToString(
      <ForgotPasswordPage error="Invalid or missing reset token. Please request a new link." sent={false} />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  }

  const prisma = getPrisma(c.env.DB);
  const now = new Date().toISOString();
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: {
        gt: now,
      },
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    const html = renderToString(
      <ForgotPasswordPage
        error="This reset link is invalid or has expired. Please request a new one."
        sent={false}
      />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  }

  const html = renderToString(<ResetPasswordPage token={token} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

auth.post("/api/auth/reset-password", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const formData = await c.req.raw.formData();
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  const renderError = (msg: string) => {
    const html = renderToString(<ResetPasswordPage token={token} error={msg} />);
    return c.html(`<!DOCTYPE html>${html}`, 400);
  };

  if (!token) return renderError("Missing reset token.");
  if (password.length < 8) return renderError("Password must be at least 8 characters.");
  if (password !== confirmPassword) return renderError("Passwords do not match.");

  const now = new Date().toISOString();
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: {
        gt: now,
      },
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return renderError("This reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  // Invalidate all existing sessions for security
  await prisma.session.deleteMany({
    where: {
      userId: user.id,
    },
  });

  return c.redirect("/login?confirmed=1");
});

export default auth;
