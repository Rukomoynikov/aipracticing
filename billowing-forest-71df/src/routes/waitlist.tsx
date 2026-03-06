import { Hono } from "hono";
import { sendEmail } from "../lib/ses";
import { confirmationEmail } from "../lib/emailTemplates";
import { getPrisma } from "../lib/prisma";

const waitlist = new Hono<{ Bindings: CloudflareBindings }>();

waitlist.post("/api/signup", async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);
    const formData = await c.req.raw.formData();

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const interest = String(formData.get("interest") || "").trim();

    if (!email || !email.includes("@")) {
      return c.json({ ok: false, error: "Please enter a valid email." }, 400);
    }

    const createdAt = new Date().toISOString();

    // Check for existing signup
    const existing = await prisma.signup.findFirst({
      where: { email },
      select: { id: true, confirmed: true },
    });

    if (existing && existing.confirmed === true) {
      return c.json({
        ok: true,
        message: "You're already confirmed — see you at the next session!",
      });
    }

    const token = crypto.randomUUID();

    if (existing) {
      // Resend confirmation
      await prisma.signup.update({
        where: { id: existing.id },
        data: { confirmationToken: token },
      });
    } else {
      await prisma.signup.create({
        data: {
          name: name || null,
          email,
          interest: interest || null,
          createdAt,
          sourceIp: c.req.raw.headers.get("CF-Connecting-IP") || null,
          userAgent: c.req.raw.headers.get("User-Agent") || null,
          confirmationToken: token,
          confirmed: false,
        },
      });
    }

    const confirmUrl = `${c.env.APP_URL}/api/confirm?token=${token}`;
    const { html, text } = confirmationEmail(confirmUrl);

    await sendEmail({
      to: email,
      subject: "Confirm your email — AI Together",
      htmlBody: html,
      textBody: text,
      fromEmail: c.env.SES_FROM_EMAIL,
      region: c.env.AWS_REGION,
      accessKeyId: c.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
    });

    return c.json({
      ok: true,
      message: "Check your inbox to confirm your email.",
    });
  } catch (error) {
    console.error("Signup error", error);
    return c.json(
      {
        ok: false,
        error:
          "Something went wrong saving your signup. Please try again in a moment, or email us directly.",
      },
      500
    );
  }
});

waitlist.get("/api/confirm", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const token = c.req.query("token");

  const errorPage = (message: string) =>
    c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmation failed</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh;
           background: #f9fafb; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 420px; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0; font-size: 15px; color: #52525b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Confirmation failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`,
      400
    );

  if (!token) {
    return errorPage("No confirmation token provided.");
  }

  const row = await prisma.signup.findFirst({
    where: { confirmationToken: token },
    select: { id: true, confirmed: true },
  });

  if (!row) {
    return errorPage("This confirmation link is invalid or has already been used.");
  }

  if (row.confirmed !== true) {
    await prisma.signup.update({
      where: { id: row.id },
      data: { confirmed: true },
    });
  }

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email confirmed</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh;
           background: #f9fafb; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 420px; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0; font-size: 15px; color: #52525b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>You're confirmed!</h1>
    <p>Your email has been verified. We'll be in touch with details for the next AI Together session.</p>
  </div>
</body>
</html>`);
});

export default waitlist;
