import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import { ensureTables } from "../lib/db";
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
    await ensureTables(c.env.DB);

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

    const existing = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?1 LIMIT 1"
    )
      .bind(email)
      .first<{ id: number }>();

    if (existing) {
      return renderError("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const token = generateToken();
    const createdAt = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO users (name, email, password_hash, confirmed, confirmation_token, created_at)
       VALUES (?1, ?2, ?3, 0, ?4, ?5)`
    )
      .bind(name, email, passwordHash, token, createdAt)
      .run();

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

  await ensureTables(c.env.DB);

  const user = await c.env.DB.prepare(
    "SELECT id, confirmed FROM users WHERE confirmation_token = ?1 LIMIT 1"
  )
    .bind(token)
    .first<{ id: number; confirmed: number }>();

  if (!user) return c.redirect("/login?error=invalid_token");

  if (user.confirmed !== 1) {
    await c.env.DB.prepare(
      "UPDATE users SET confirmed = 1, confirmation_token = NULL WHERE id = ?1"
    )
      .bind(user.id)
      .run();
  }

  const sessionToken = await createSession(c.env.DB, user.id);
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
  await ensureTables(c.env.DB);

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

  const user = await c.env.DB.prepare(
    "SELECT id, name, email, password_hash, confirmed FROM users WHERE email = ?1 LIMIT 1"
  )
    .bind(email)
    .first<{ id: number; name: string; email: string; password_hash: string; confirmed: number }>();

  if (!user) return renderError("Invalid email or password.");

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return renderError("Invalid email or password.");

  if (user.confirmed !== 1) {
    return renderError("Please confirm your email before signing in.");
  }

  const token = await createSession(c.env.DB, user.id);
  setSessionCookie(c, token);
  return c.redirect("/dashboard");
});

// ── Logout ───────────────────────────────────────────────────────────────────

auth.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await deleteSession(c.env.DB, token);
  }
  clearSessionCookie(c);
  return c.redirect("/login");
});

// ── Dashboard ────────────────────────────────────────────────────────────────

auth.get("/dashboard", async (c) => {
  await ensureTables(c.env.DB);

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");

  const user = await getSession(c.env.DB, token);
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
  await ensureTables(c.env.DB);

  const formData = await c.req.raw.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    const html = renderToString(
      <ForgotPasswordPage error="Please enter a valid email." />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1 AND confirmed = 1 LIMIT 1"
  )
    .bind(email)
    .first<{ id: number }>();

  // Always show success to prevent email enumeration
  if (user) {
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await c.env.DB.prepare(
      "UPDATE users SET reset_token = ?1, reset_token_expires = ?2 WHERE id = ?3"
    )
      .bind(resetToken, expiresAt, user.id)
      .run();

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

  await ensureTables(c.env.DB);
  const now = new Date().toISOString();
  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE reset_token = ?1 AND reset_token_expires > ?2 LIMIT 1"
  )
    .bind(token, now)
    .first<{ id: number }>();

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
  await ensureTables(c.env.DB);

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
  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE reset_token = ?1 AND reset_token_expires > ?2 LIMIT 1"
  )
    .bind(token, now)
    .first<{ id: number }>();

  if (!user) {
    return renderError("This reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?1, reset_token = NULL, reset_token_expires = NULL WHERE id = ?2"
  )
    .bind(passwordHash, user.id)
    .run();

  // Invalidate all existing sessions for security
  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1")
    .bind(user.id)
    .run();

  return c.redirect("/login?confirmed=1");
});

export default auth;
