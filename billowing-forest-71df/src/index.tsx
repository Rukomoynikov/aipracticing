import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { setCookie, getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import App from "./App";
import { sendEmail } from "./lib/ses";
import { confirmationEmail, passwordResetEmail, eventSignupConfirmationEmail } from "./lib/emailTemplates";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  deleteSession,
  getSession,
} from "./lib/auth";
import SignupPage from "./components/auth/SignupPage";
import LoginPage from "./components/auth/LoginPage";
import ForgotPasswordPage from "./components/auth/ForgotPasswordPage";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import DashboardPage from "./components/auth/DashboardPage";
import AdminDashboardPage from "./components/auth/AdminDashboardPage";
import CreateEventPage from "./components/auth/CreateEventPage";
import EventsListPage from "./components/auth/EventsListPage";
import EditEventPage from "./components/auth/EditEventPage";
import EventSignupsPage from "./components/auth/EventSignupsPage";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(secureHeaders());

// ── Ensure DB tables exist ──────────────────────────────────────────────────

async function ensureTables(db: CloudflareBindings["DB"]) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        confirmed INTEGER DEFAULT 0,
        confirmation_token TEXT,
        reset_token TEXT,
        reset_token_expires TEXT,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  // Add role column for existing databases
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'").run();
  } catch {
    // Column already exists — ignore
  }

  // Add location_name column for existing databases
  try {
    await db.prepare("ALTER TABLE events ADD COLUMN location_name TEXT").run();
  } catch {
    // Column already exists — ignore
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        datetime TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        capacity INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS event_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        confirmation_token TEXT,
        confirmed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`
    )
    .run();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

function clearSessionCookie(c: Parameters<typeof setCookie>[0]) {
  setCookie(c, SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 0,
    path: "/",
  });
}

// ── Home ────────────────────────────────────────────────────────────────────

app.get("/", async (c) => {
  await ensureTables(c.env.DB);

  const token = getCookie(c, SESSION_COOKIE);
  const currentUser = token ? await getSession(c.env.DB, token).catch(() => null) : null;
  const isAuthenticated = !!currentUser;

  const nextEvent = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.description, e.datetime, e.capacity, e.latitude, e.longitude, e.location_name,
            COUNT(es.id) as signupCount
     FROM events e
     LEFT JOIN event_signups es ON es.event_id = e.id AND es.confirmed = 1
     WHERE e.datetime > ?1
     GROUP BY e.id
     ORDER BY e.datetime ASC
     LIMIT 1`
  )
    .bind(new Date().toISOString())
    .first<{
      id: number;
      title: string;
      description: string | null;
      datetime: string;
      capacity: number;
      latitude: number;
      longitude: number;
      location_name: string | null;
      signupCount: number;
    }>()
    .catch(() => null);

  let isSignedUp = false;
  if (currentUser && nextEvent) {
    const existing = await c.env.DB.prepare(
      `SELECT id FROM event_signups WHERE event_id = ?1 AND email = ?2 LIMIT 1`
    ).bind(nextEvent.id, currentUser.email).first().catch(() => null);
    isSignedUp = !!existing;
  }

  const html = renderToString(
    <App
      isAuthenticated={isAuthenticated}
      nextEvent={nextEvent ?? null}
      isSignedUp={isSignedUp}
      currentUser={
        currentUser
          ? { name: currentUser.name, email: currentUser.email }
          : null
      }
    />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Waitlist signup (existing) ───────────────────────────────────────────────

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

// ── Auth: Sign up ────────────────────────────────────────────────────────────

app.get("/signup", (c) => {
  const html = renderToString(<SignupPage />);
  return c.html(`<!DOCTYPE html>${html}`);
});

app.post("/api/auth/signup", async (c) => {
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

// ── Auth: Email confirmation ──────────────────────────────────────────────────

app.get("/api/auth/confirm", async (c) => {
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

// ── Auth: Login ──────────────────────────────────────────────────────────────

app.get("/login", (c) => {
  const confirmed = c.req.query("confirmed") === "1";
  const checkEmail = c.req.query("check_email") === "1";
  const errorParam = c.req.query("error");

  let error: string | undefined;
  if (errorParam === "invalid_token") error = "This confirmation link is invalid or has already been used.";
  if (errorParam === "missing_token") error = "No confirmation token provided.";

  // Reuse success banner slot for "check your email"
  const html = renderToString(
    <LoginPage
      confirmed={confirmed}
      error={checkEmail ? undefined : error}
    />
  );
  // If check_email, show a different banner by passing a custom flag through confirmed-style rendering
  if (checkEmail) {
    const html2 = renderToString(
      <LoginPage
        confirmed={false}
        error="Account created! Check your inbox to confirm your email before signing in."
      />
    );
    return c.html(`<!DOCTYPE html>${html2}`);
  }
  return c.html(`<!DOCTYPE html>${html}`);
});

app.post("/api/auth/login", async (c) => {
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

// ── Auth: Dashboard ──────────────────────────────────────────────────────────

app.get("/dashboard", async (c) => {
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

// ── Auth: Admin Dashboard ─────────────────────────────────────────────────────

app.get("/dashboard/admin", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) {
    clearSessionCookie(c);
    return c.redirect("/login");
  }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const html = renderToString(<AdminDashboardPage user={user} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Admin: Create Event ───────────────────────────────────────────────────────

app.get("/dashboard/admin/events/new", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) {
    clearSessionCookie(c);
    return c.redirect("/login");
  }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const html = renderToString(<CreateEventPage user={user} mapsApiKey={c.env.GOOGLE_MAPS_API_KEY} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

app.post("/api/admin/events", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) {
    clearSessionCookie(c);
    return c.redirect("/login");
  }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const formData = await c.req.raw.formData();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const datetime = String(formData.get("datetime") || "").trim();
  const latStr = String(formData.get("latitude") || "").trim();
  const lngStr = String(formData.get("longitude") || "").trim();
  const capacityStr = String(formData.get("capacity") || "").trim();
  const locationName = String(formData.get("location_name") || "").trim();

  const renderError = (msg: string) => {
    const html = renderToString(
      <CreateEventPage
        user={user}
        mapsApiKey={c.env.GOOGLE_MAPS_API_KEY}
        error={msg}
        values={{ title, description, datetime, capacity: capacityStr, latitude: latStr, longitude: lngStr, locationName }}
      />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  };

  if (!title) return renderError("Title is required.");
  if (!datetime) return renderError("Date and time are required.");

  if (!latStr || !lngStr) return renderError("Please select a location on the map.");
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lngStr);
  if (isNaN(latitude) || isNaN(longitude)) return renderError("Invalid location coordinates.");
  if (latitude < -90 || latitude > 90) return renderError("Latitude must be between -90 and 90.");
  if (longitude < -180 || longitude > 180) return renderError("Longitude must be between -180 and 180.");

  const capacity = parseInt(capacityStr, 10);
  if (!capacityStr || isNaN(capacity) || capacity < 1) return renderError("Capacity must be at least 1.");

  const createdAt = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO events (title, description, datetime, latitude, longitude, capacity, location_name, created_by, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(title, description || null, datetime, latitude, longitude, capacity, locationName || null, user.id, createdAt)
    .run();

  return c.redirect("/dashboard/admin");
});

// ── Admin: Events list ────────────────────────────────────────────────────────

app.get("/dashboard/admin/events", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) { clearSessionCookie(c); return c.redirect("/login"); }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const success = c.req.query("success");

  const events = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.datetime, e.capacity,
            COUNT(es.id) as signupCount
     FROM events e
     LEFT JOIN event_signups es ON es.event_id = e.id AND es.confirmed = 1
     GROUP BY e.id
     ORDER BY e.datetime DESC`
  ).all<{ id: number; title: string; datetime: string; capacity: number; signupCount: number }>();

  const html = renderToString(
    <EventsListPage events={events.results} success={success ?? undefined} />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Admin: Edit Event (form) ──────────────────────────────────────────────────

app.get("/dashboard/admin/events/:id/edit", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) { clearSessionCookie(c); return c.redirect("/login"); }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const eventId = parseInt(c.req.param("id"), 10);
  if (isNaN(eventId)) return c.redirect("/dashboard/admin/events");

  const event = await c.env.DB.prepare(
    "SELECT id, title, description, datetime, latitude, longitude, capacity, location_name FROM events WHERE id = ?1 LIMIT 1"
  )
    .bind(eventId)
    .first<{ id: number; title: string; description: string | null; datetime: string; latitude: number; longitude: number; capacity: number; location_name: string | null }>();

  if (!event) return c.redirect("/dashboard/admin/events");

  // datetime-local input needs format: YYYY-MM-DDTHH:mm
  const dtLocal = event.datetime.slice(0, 16);

  const html = renderToString(
    <EditEventPage
      user={user}
      eventId={event.id}
      mapsApiKey={c.env.GOOGLE_MAPS_API_KEY}
      values={{
        title: event.title,
        description: event.description ?? "",
        datetime: dtLocal,
        capacity: String(event.capacity),
        latitude: String(event.latitude),
        longitude: String(event.longitude),
        locationName: event.location_name ?? "",
      }}
    />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Admin: Update Event ───────────────────────────────────────────────────────

app.post("/api/admin/events/:id", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) { clearSessionCookie(c); return c.redirect("/login"); }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const eventId = parseInt(c.req.param("id"), 10);
  if (isNaN(eventId)) return c.redirect("/dashboard/admin/events");

  const existing = await c.env.DB.prepare("SELECT id FROM events WHERE id = ?1 LIMIT 1")
    .bind(eventId)
    .first<{ id: number }>();
  if (!existing) return c.redirect("/dashboard/admin/events");

  const formData = await c.req.raw.formData();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const datetime = String(formData.get("datetime") || "").trim();
  const latStr = String(formData.get("latitude") || "").trim();
  const lngStr = String(formData.get("longitude") || "").trim();
  const capacityStr = String(formData.get("capacity") || "").trim();
  const locationName = String(formData.get("location_name") || "").trim();

  const renderError = (msg: string) => {
    const html = renderToString(
      <EditEventPage
        user={user}
        eventId={eventId}
        mapsApiKey={c.env.GOOGLE_MAPS_API_KEY}
        error={msg}
        values={{ title, description, datetime, capacity: capacityStr, latitude: latStr, longitude: lngStr, locationName }}
      />
    );
    return c.html(`<!DOCTYPE html>${html}`, 400);
  };

  if (!title) return renderError("Title is required.");
  if (!datetime) return renderError("Date and time are required.");
  if (!latStr || !lngStr) return renderError("Please select a location on the map.");

  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lngStr);
  if (isNaN(latitude) || isNaN(longitude)) return renderError("Invalid location coordinates.");
  if (latitude < -90 || latitude > 90) return renderError("Latitude must be between -90 and 90.");
  if (longitude < -180 || longitude > 180) return renderError("Longitude must be between -180 and 180.");

  const capacity = parseInt(capacityStr, 10);
  if (!capacityStr || isNaN(capacity) || capacity < 1) return renderError("Capacity must be at least 1.");

  await c.env.DB.prepare(
    `UPDATE events SET title = ?1, description = ?2, datetime = ?3, latitude = ?4, longitude = ?5, capacity = ?6, location_name = ?7
     WHERE id = ?8`
  )
    .bind(title, description || null, datetime, latitude, longitude, capacity, locationName || null, eventId)
    .run();

  return c.redirect("/dashboard/admin/events?success=Event%20updated%20successfully.");
});

// ── Admin: Delete Event ───────────────────────────────────────────────────────

app.post("/api/admin/events/:id/delete", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) { clearSessionCookie(c); return c.redirect("/login"); }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const eventId = parseInt(c.req.param("id"), 10);
  if (!isNaN(eventId)) {
    await c.env.DB.prepare("DELETE FROM event_signups WHERE event_id = ?1").bind(eventId).run();
    await c.env.DB.prepare("DELETE FROM events WHERE id = ?1").bind(eventId).run();
  }

  return c.redirect("/dashboard/admin/events?success=Event%20deleted.");
});

// ── Admin: Event Signups ──────────────────────────────────────────────────────

app.get("/dashboard/admin/events/:id/signups", async (c) => {
  await ensureTables(c.env.DB);
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.redirect("/login");
  const user = await getSession(c.env.DB, token);
  if (!user) { clearSessionCookie(c); return c.redirect("/login"); }
  if (user.role !== "admin") return c.redirect("/dashboard");

  const eventId = parseInt(c.req.param("id"), 10);
  if (isNaN(eventId)) return c.redirect("/dashboard/admin/events");

  const event = await c.env.DB.prepare(
    "SELECT id, title, datetime, capacity FROM events WHERE id = ?1 LIMIT 1"
  )
    .bind(eventId)
    .first<{ id: number; title: string; datetime: string; capacity: number }>();

  if (!event) return c.redirect("/dashboard/admin/events");

  const signups = await c.env.DB.prepare(
    `SELECT id, name, email, confirmed, created_at
     FROM event_signups
     WHERE event_id = ?1
     ORDER BY confirmed DESC, created_at ASC`
  )
    .bind(eventId)
    .all<{ id: number; name: string; email: string; confirmed: number; created_at: string }>();

  const html = renderToString(
    <EventSignupsPage event={event} signups={signups.results} />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Event signup ─────────────────────────────────────────────────────────────

app.post("/api/events/:eventId/signup", async (c) => {
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

app.get("/api/events/confirm", async (c) => {
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

// ── Auth: Logout ─────────────────────────────────────────────────────────────

app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await deleteSession(c.env.DB, token);
  }
  clearSessionCookie(c);
  return c.redirect("/login");
});

// ── Auth: Forgot password ────────────────────────────────────────────────────

app.get("/forgot-password", (c) => {
  const html = renderToString(<ForgotPasswordPage />);
  return c.html(`<!DOCTYPE html>${html}`);
});

app.post("/api/auth/forgot-password", async (c) => {
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

// ── Auth: Reset password ─────────────────────────────────────────────────────

app.get("/reset-password", async (c) => {
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

app.post("/api/auth/reset-password", async (c) => {
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

// ── Misc ─────────────────────────────────────────────────────────────────────

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
