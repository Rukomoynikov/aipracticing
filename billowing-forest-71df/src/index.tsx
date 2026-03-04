import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { renderToString } from "react-dom/server";
import App from "./App";
import { sendEmail } from "./lib/ses";
import { confirmationEmail } from "./lib/emailTemplates";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(secureHeaders());

app.get("/", (c) => {
  const html = renderToString(<App />);
  return c.html(`<!DOCTYPE html>${html}`);
});

app.post("/api/signup", async (c) => {
  try {
    const formData = await c.req.raw.formData();

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const interest = String(formData.get("interest") || "").trim();

    if (!email || !email.includes("@")) {
      return c.json({ ok: false, error: "Please enter a valid email." }, 400);
    }

    const createdAt = new Date().toISOString();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT NOT NULL,
        interest TEXT,
        created_at TEXT NOT NULL,
        source_ip TEXT,
        user_agent TEXT
      )`
    ).run();

    // Add confirmation columns if they don't exist yet
    for (const stmt of [
      "ALTER TABLE signups ADD COLUMN confirmation_token TEXT",
      "ALTER TABLE signups ADD COLUMN confirmed INTEGER DEFAULT 0",
    ]) {
      try {
        await c.env.DB.prepare(stmt).run();
      } catch {
        // Column already exists — ignore
      }
    }

    // Check for existing signup
    const existing = await c.env.DB.prepare(
      "SELECT id, confirmed FROM signups WHERE email = ?1 LIMIT 1"
    )
      .bind(email)
      .first<{ id: number; confirmed: number }>();

    if (existing && existing.confirmed === 1) {
      return c.json({
        ok: true,
        message: "You're already confirmed — see you at the next session!",
      });
    }

    const token = crypto.randomUUID();

    if (existing) {
      // Resend confirmation
      await c.env.DB.prepare(
        "UPDATE signups SET confirmation_token = ?1 WHERE id = ?2"
      )
        .bind(token, existing.id)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO signups (name, email, interest, created_at, source_ip, user_agent, confirmation_token, confirmed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)`
      )
        .bind(
          name || null,
          email,
          interest || null,
          createdAt,
          c.req.raw.headers.get("CF-Connecting-IP") || null,
          c.req.raw.headers.get("User-Agent") || null,
          token
        )
        .run();
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

app.get("/api/confirm", async (c) => {
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

  const row = await c.env.DB.prepare(
    "SELECT id, confirmed FROM signups WHERE confirmation_token = ?1 LIMIT 1"
  )
    .bind(token)
    .first<{ id: number; confirmed: number }>();

  if (!row) {
    return errorPage("This confirmation link is invalid or has already been used.");
  }

  if (row.confirmed !== 1) {
    await c.env.DB.prepare(
      "UPDATE signups SET confirmed = 1 WHERE id = ?1"
    )
      .bind(row.id)
      .run();
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

app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
