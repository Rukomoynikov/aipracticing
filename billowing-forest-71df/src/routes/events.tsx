import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { ensureTables } from "../lib/db";
import { SESSION_COOKIE } from "../lib/session";
import { generateToken, getSession } from "../lib/auth";
import { sendEmail } from "../lib/ses";
import { eventSignupConfirmationEmail } from "../lib/emailTemplates";

const events = new Hono<{ Bindings: CloudflareBindings }>();

events.post("/api/events/:eventId/signup", async (c) => {
  await ensureTables(c.env.DB);

  const eventId = parseInt(c.req.param("eventId"), 10);
  if (isNaN(eventId)) {
    return c.json({ ok: false, error: "Invalid event ID." }, 400);
  }

  const event = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.datetime, e.capacity,
            COUNT(es.id) as signupCount
     FROM events e
     LEFT JOIN event_signups es ON es.event_id = e.id AND es.confirmed = 1
     WHERE e.id = ?1
     GROUP BY e.id`
  )
    .bind(eventId)
    .first<{ id: number; title: string; datetime: string; capacity: number; signupCount: number }>();

  if (!event) return c.json({ ok: false, error: "Event not found." }, 404);
  if (event.signupCount >= event.capacity) {
    return c.json({ ok: false, error: "This event is fully booked." }, 400);
  }

  const formData = await c.req.raw.formData();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!name) return c.json({ ok: false, error: "Please enter your name." }, 400);
  if (!email || !email.includes("@")) {
    return c.json({ ok: false, error: "Please enter a valid email." }, 400);
  }

  const sessionToken = getCookie(c, SESSION_COOKIE);
  const sessionUser = sessionToken
    ? await getSession(c.env.DB, sessionToken).catch(() => null)
    : null;

  const existing = await c.env.DB.prepare(
    "SELECT id, confirmed FROM event_signups WHERE event_id = ?1 AND email = ?2 LIMIT 1"
  )
    .bind(eventId, email)
    .first<{ id: number; confirmed: number }>();

  if (existing && existing.confirmed === 1) {
    return c.json({ ok: true, message: "You're already signed up for this event!" });
  }

  const createdAt = new Date().toISOString();

  if (sessionUser) {
    // Authenticated: direct signup, no email needed
    if (existing) {
      await c.env.DB.prepare(
        "UPDATE event_signups SET confirmed = 1, user_id = ?1, name = ?2, confirmation_token = NULL WHERE id = ?3"
      )
        .bind(sessionUser.id, name, existing.id)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO event_signups (event_id, user_id, name, email, confirmed, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, ?5)`
      )
        .bind(eventId, sessionUser.id, name, email, createdAt)
        .run();
    }
    return c.json({ ok: true, message: "You're signed up! See you there." });
  } else {
    // Not authenticated: pending signup, send confirmation email
    const token = generateToken();

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE event_signups SET confirmation_token = ?1, name = ?2 WHERE id = ?3"
      )
        .bind(token, name, existing.id)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO event_signups (event_id, user_id, name, email, confirmation_token, confirmed, created_at)
         VALUES (?1, NULL, ?2, ?3, ?4, 0, ?5)`
      )
        .bind(eventId, name, email, token, createdAt)
        .run();
    }

    const confirmUrl = `${c.env.APP_URL}/api/events/confirm?token=${token}`;
    const eventDate = new Date(event.datetime).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY) {
      const { html: emailHtml, text: emailText } = eventSignupConfirmationEmail(
        confirmUrl,
        event.title,
        eventDate
      );
      await sendEmail({
        to: email,
        subject: `Confirm your spot — ${event.title}`,
        htmlBody: emailHtml,
        textBody: emailText,
        fromEmail: c.env.SES_FROM_EMAIL,
        region: c.env.AWS_REGION,
        accessKeyId: c.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      });
    } else {
      console.log(`[dev] Event signup confirm URL for ${email}: ${confirmUrl}`);
    }

    return c.json({ ok: true, message: "Check your inbox to confirm your spot." });
  }
});

events.get("/api/events/confirm", async (c) => {
  await ensureTables(c.env.DB);

  const token = c.req.query("token");

  const errorHtml = (message: string) =>
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

  if (!token) return errorHtml("No confirmation token provided.");

  const signup = await c.env.DB.prepare(
    `SELECT es.id, es.event_id, es.confirmed, e.title, e.datetime
     FROM event_signups es
     JOIN events e ON e.id = es.event_id
     WHERE es.confirmation_token = ?1 LIMIT 1`
  )
    .bind(token)
    .first<{ id: number; event_id: number; confirmed: number; title: string; datetime: string }>();

  if (!signup) return errorHtml("This confirmation link is invalid or has already been used.");

  if (signup.confirmed !== 1) {
    await c.env.DB.prepare(
      "UPDATE event_signups SET confirmed = 1, confirmation_token = NULL WHERE id = ?1"
    )
      .bind(signup.id)
      .run();
  }

  const eventDate = new Date(signup.datetime).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're confirmed!</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh;
           background: #f9fafb; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 420px; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0 0 8px; font-size: 15px; color: #52525b; line-height: 1.6; }
    .event { font-weight: 600; color: #18181b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>You're confirmed!</h1>
    <p class="event">${signup.title}</p>
    <p>${eventDate}</p>
    <p style="margin-top:16px;">See you there!</p>
    <p style="margin-top:24px;"><a href="/" style="color:#2b6a92;">Back to home</a></p>
  </div>
</body>
</html>`);
});

export default events;
