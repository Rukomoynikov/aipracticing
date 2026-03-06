import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../lib/session";
import { generateToken, getSession } from "../lib/auth";
import { sendEmail } from "../lib/ses";
import { eventSignupConfirmationEmail, eventSignupThankYouEmail } from "../lib/emailTemplates";
import { getPrisma } from "../lib/prisma";

const events = new Hono<{ Bindings: CloudflareBindings }>();

events.post("/api/events/:eventId/signup", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const eventId = parseInt(c.req.param("eventId"), 10);
  if (isNaN(eventId)) {
    return c.json({ ok: false, error: "Invalid event ID." }, 400);
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      dateTime: true,
      capacity: true,
      _count: {
        select: {
          signups: {
            where: {
              confirmed: true,
            },
          },
        },
      },
    },
  });

  if (!event) return c.json({ ok: false, error: "Event not found." }, 404);
  if (event._count.signups >= event.capacity) {
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
    ? await getSession(prisma, sessionToken).catch(() => null)
    : null;

  const existing = await prisma.eventSignup.findFirst({
    where: {
      eventId,
      email,
    },
    select: {
      id: true,
      confirmed: true,
    },
  });

  if (existing && existing.confirmed === true) {
    return c.json({ ok: true, message: "You're already signed up for this event!" });
  }

  const createdAt = new Date().toISOString();

  if (sessionUser) {
    // Authenticated: direct signup, send thank-you email
    const cancelToken = generateToken();
    if (existing) {
      await prisma.eventSignup.update({
        where: { id: existing.id },
        data: {
          confirmed: true,
          userId: sessionUser.id,
          name,
          confirmationToken: null,
          cancellationToken: cancelToken,
        },
      });
    } else {
      await prisma.eventSignup.create({
        data: {
          eventId,
          userId: sessionUser.id,
          name,
          email,
          confirmed: true,
          createdAt,
          cancellationToken: cancelToken,
        },
      });
    }

    const cancelUrl = `${c.env.APP_URL}/api/events/cancel?token=${cancelToken}`;
    const eventDate = new Date(event.dateTime).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY) {
      const { html: emailHtml, text: emailText } = eventSignupThankYouEmail(
        event.title,
        eventDate,
        cancelUrl,
        new Date(event.dateTime),
        `${c.env.APP_URL}/api/events/${event.id}/calendar.ics`
      );
      await sendEmail({
        to: email,
        subject: `You're in! ${event.title}`,
        htmlBody: emailHtml,
        textBody: emailText,
        fromEmail: c.env.SES_FROM_EMAIL,
        region: c.env.AWS_REGION,
        accessKeyId: c.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      });
    } else {
      console.log(`[dev] Cancel URL for ${email}: ${cancelUrl}`);
    }

    return c.json({ ok: true, message: "You're signed up! See you there." });
  } else {
    // Not authenticated: pending signup, send confirmation email
    const token = generateToken();

    if (existing) {
      await prisma.eventSignup.update({
        where: { id: existing.id },
        data: {
          confirmationToken: token,
          name,
        },
      });
    } else {
      await prisma.eventSignup.create({
        data: {
          eventId,
          userId: null,
          name,
          email,
          confirmationToken: token,
          confirmed: false,
          createdAt,
        },
      });
    }

    const confirmUrl = `${c.env.APP_URL}/api/events/confirm?token=${token}`;
    const eventDate = new Date(event.dateTime).toLocaleDateString("en-GB", {
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

events.get("/api/events/:eventId/calendar.ics", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const eventId = parseInt(c.req.param("eventId"), 10);
  if (isNaN(eventId)) return c.text("Invalid event ID.", 400);

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { title: true, dateTime: true },
  });
  if (!event) return c.text("Event not found.", 404);

  const start = new Date(event.dateTime);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const now = fmt(new Date());

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Together//EN",
    "BEGIN:VEVENT",
    `UID:event-${eventId}@aitogether`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${eventId}.ics"`,
    },
  });
});

events.get("/api/events/confirm", async (c) => {
  const prisma = getPrisma(c.env.DB);

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

  const signup = await prisma.eventSignup.findFirst({
    where: {
      confirmationToken: token,
    },
    select: {
      id: true,
      eventId: true,
      email: true,
      confirmed: true,
      event: {
        select: {
          title: true,
          dateTime: true,
        },
      },
    },
  });

  if (!signup) return errorHtml("This confirmation link is invalid or has already been used.");

  const eventDate = new Date(signup.event.dateTime).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (signup.confirmed !== true) {
    const cancelToken = generateToken();
    await prisma.eventSignup.update({
      where: {
        id: signup.id,
      },
      data: {
        confirmed: true,
        confirmationToken: null,
        cancellationToken: cancelToken,
      },
    });

    const cancelUrl = `${c.env.APP_URL}/api/events/cancel?token=${cancelToken}`;
    if (c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY) {
      const { html: emailHtml, text: emailText } = eventSignupThankYouEmail(
        signup.event.title,
        eventDate,
        cancelUrl,
        new Date(signup.event.dateTime),
        `${c.env.APP_URL}/api/events/${signup.eventId}/calendar.ics`
      );
      await sendEmail({
        to: signup.email,
        subject: `You're in! ${signup.event.title}`,
        htmlBody: emailHtml,
        textBody: emailText,
        fromEmail: c.env.SES_FROM_EMAIL,
        region: c.env.AWS_REGION,
        accessKeyId: c.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      });
    } else {
      console.log(`[dev] Cancel URL for ${signup.email}: ${cancelUrl}`);
    }
  }

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
    <p class="event">${signup.event.title}</p>
    <p>${eventDate}</p>
    <p style="margin-top:16px;">See you there!</p>
    <p style="margin-top:24px;"><a href="/" style="color:#2b6a92;">Back to home</a></p>
  </div>
</body>
</html>`);
});

events.get("/api/events/cancel", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const token = c.req.query("token");

  const errorHtml = (message: string) =>
    c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cancellation failed</title>
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
    <h1>Cancellation failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`,
      400
    );

  if (!token) return errorHtml("No cancellation token provided.");

  const signup = await prisma.eventSignup.findFirst({
    where: { cancellationToken: token },
    select: {
      id: true,
      event: {
        select: { title: true },
      },
    },
  });

  if (!signup) return errorHtml("This cancellation link is invalid or has already been used.");

  await prisma.eventSignup.update({
    where: { id: signup.id },
    data: { confirmed: false, cancellationToken: null },
  });

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spot freed</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh;
           background: #f9fafb; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 420px; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #18181b; }
    p { margin: 0 0 8px; font-size: 15px; color: #52525b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128075;</div>
    <h1>You're off the list</h1>
    <p>Your spot for <strong>${signup.event.title}</strong> has been freed. We hope to see you at a future event!</p>
    <p style="margin-top:24px;"><a href="/" style="color:#2b6a92;">Back to home</a></p>
  </div>
</body>
</html>`);
});

export default events;
