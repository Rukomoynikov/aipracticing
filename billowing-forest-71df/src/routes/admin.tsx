import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import { ensureTables } from "../lib/db";
import { SESSION_COOKIE, clearSessionCookie } from "../lib/session";
import { getSession } from "../lib/auth";
import AdminDashboardPage from "../components/auth/AdminDashboardPage";
import CreateEventPage from "../components/auth/CreateEventPage";
import EventsListPage from "../components/auth/EventsListPage";
import EditEventPage from "../components/auth/EditEventPage";
import EventSignupsPage from "../components/auth/EventSignupsPage";

const admin = new Hono<{ Bindings: CloudflareBindings }>();

async function requireAdmin(c: Context<{ Bindings: CloudflareBindings }>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return { user: null, redirect: "/login" as const };
  const user = await getSession(c.env.DB, token);
  if (!user) {
    clearSessionCookie(c);
    return { user: null, redirect: "/login" as const };
  }
  if (user.role !== "admin") return { user: null, redirect: "/dashboard" as const };
  return { user, redirect: null };
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

admin.get("/dashboard/admin", async (c) => {
  await ensureTables(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const html = renderToString(<AdminDashboardPage user={user!} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Create Event ──────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events/new", async (c) => {
  await ensureTables(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const html = renderToString(<CreateEventPage user={user!} mapsApiKey={c.env.GOOGLE_MAPS_API_KEY} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

admin.post("/api/admin/events", async (c) => {
  await ensureTables(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

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
        user={user!}
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
    .bind(title, description || null, datetime, latitude, longitude, capacity, locationName || null, user!.id, createdAt)
    .run();

  return c.redirect("/dashboard/admin");
});

// ── Events List ───────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events", async (c) => {
  await ensureTables(c.env.DB);
  const { redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

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

// ── Edit Event ────────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events/:id/edit", async (c) => {
  await ensureTables(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

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
      user={user!}
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

// ── Update Event ──────────────────────────────────────────────────────────────

admin.post("/api/admin/events/:id", async (c) => {
  await ensureTables(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

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
        user={user!}
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

// ── Delete Event ──────────────────────────────────────────────────────────────

admin.post("/api/admin/events/:id/delete", async (c) => {
  await ensureTables(c.env.DB);
  const { redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const eventId = parseInt(c.req.param("id"), 10);
  if (!isNaN(eventId)) {
    await c.env.DB.prepare("DELETE FROM event_signups WHERE event_id = ?1").bind(eventId).run();
    await c.env.DB.prepare("DELETE FROM events WHERE id = ?1").bind(eventId).run();
  }

  return c.redirect("/dashboard/admin/events?success=Event%20deleted.");
});

// ── Event Signups ─────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events/:id/signups", async (c) => {
  await ensureTables(c.env.DB);
  const { redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

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

export default admin;
