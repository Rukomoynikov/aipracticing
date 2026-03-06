import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import { SESSION_COOKIE, clearSessionCookie } from "../lib/session";
import { getSession } from "../lib/auth";
import { getPrisma } from "../lib/prisma";
import AdminDashboardPage from "../components/auth/AdminDashboardPage";
import CreateEventPage from "../components/auth/CreateEventPage";
import EventsListPage from "../components/auth/EventsListPage";
import EditEventPage from "../components/auth/EditEventPage";
import EventSignupsPage from "../components/auth/EventSignupsPage";

const admin = new Hono<{ Bindings: CloudflareBindings }>();

async function requireAdmin(c: Context<{ Bindings: CloudflareBindings }>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return { user: null, redirect: "/login" as const };
  const prisma = getPrisma(c.env.DB);
  const user = await getSession(prisma, token);
  if (!user) {
    clearSessionCookie(c);
    return { user: null, redirect: "/login" as const };
  }
  if (user.role !== "admin") return { user: null, redirect: "/dashboard" as const };
  return { user, redirect: null };
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

admin.get("/dashboard/admin", async (c) => {
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const html = renderToString(<AdminDashboardPage user={user!} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Create Event ──────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events/new", async (c) => {
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const html = renderToString(<CreateEventPage user={user!} mapsApiKey={c.env.GOOGLE_MAPS_API_KEY} />);
  return c.html(`<!DOCTYPE html>${html}`);
});

admin.post("/api/admin/events", async (c) => {
  const prisma = getPrisma(c.env.DB);
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
  await prisma.event.create({
    data: {
      title,
      description: description || null,
      dateTime: datetime,
      latitude,
      longitude,
      capacity,
      locationName: locationName || null,
      createdBy: user!.id,
      createdAt,
    },
  });

  return c.redirect("/dashboard/admin");
});

// ── Events List ───────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const success = c.req.query("success");

  const eventsRows = await prisma.event.findMany({
    orderBy: {
      dateTime: "desc",
    },
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

  const events = eventsRows.map((event) => ({
    id: event.id,
    title: event.title,
    datetime: event.dateTime,
    capacity: event.capacity,
    signupCount: event._count.signups,
  }));

  const html = renderToString(
    <EventsListPage events={events} success={success ?? undefined} />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Edit Event ────────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events/:id/edit", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const eventId = parseInt(c.req.param("id"), 10);
  if (isNaN(eventId)) return c.redirect("/dashboard/admin/events");

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      dateTime: true,
      latitude: true,
      longitude: true,
      capacity: true,
      locationName: true,
    },
  });

  if (!event) return c.redirect("/dashboard/admin/events");

  // datetime-local input needs format: YYYY-MM-DDTHH:mm
  const dtLocal = event.dateTime.slice(0, 16);

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
        locationName: event.locationName ?? "",
      }}
    />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

// ── Update Event ──────────────────────────────────────────────────────────────

admin.post("/api/admin/events/:id", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { user, redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const eventId = parseInt(c.req.param("id"), 10);
  if (isNaN(eventId)) return c.redirect("/dashboard/admin/events");

  const existing = await prisma.event.findFirst({
    where: {
      id: eventId,
    },
    select: {
      id: true,
    },
  });
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

  await prisma.event.update({
    where: {
      id: eventId,
    },
    data: {
      title,
      description: description || null,
      dateTime: datetime,
      latitude,
      longitude,
      capacity,
      locationName: locationName || null,
    },
  });

  return c.redirect("/dashboard/admin/events?success=Event%20updated%20successfully.");
});

// ── Delete Event ──────────────────────────────────────────────────────────────

admin.post("/api/admin/events/:id/delete", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const eventId = parseInt(c.req.param("id"), 10);
  if (!isNaN(eventId)) {
    await prisma.eventSignup.deleteMany({
      where: {
        eventId,
      },
    });
    await prisma.event.deleteMany({
      where: {
        id: eventId,
      },
    });
  }

  return c.redirect("/dashboard/admin/events?success=Event%20deleted.");
});

// ── Event Signups ─────────────────────────────────────────────────────────────

admin.get("/dashboard/admin/events/:id/signups", async (c) => {
  const prisma = getPrisma(c.env.DB);
  const { redirect } = await requireAdmin(c);
  if (redirect) return c.redirect(redirect);

  const eventId = parseInt(c.req.param("id"), 10);
  if (isNaN(eventId)) return c.redirect("/dashboard/admin/events");

  const eventRow = await prisma.event.findFirst({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      title: true,
      dateTime: true,
      capacity: true,
    },
  });

  if (!eventRow) return c.redirect("/dashboard/admin/events");

  const signupsRows = await prisma.eventSignup.findMany({
    where: {
      eventId,
    },
    orderBy: [
      {
        confirmed: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
      name: true,
      email: true,
      confirmed: true,
      createdAt: true,
    },
  });

  const event = {
    id: eventRow.id,
    title: eventRow.title,
    datetime: eventRow.dateTime,
    capacity: eventRow.capacity,
  };
  const signups = signupsRows.map((signup) => ({
    id: signup.id,
    name: signup.name,
    email: signup.email,
    confirmed: signup.confirmed ? 1 : 0,
    created_at: signup.createdAt,
  }));

  const html = renderToString(
    <EventSignupsPage event={event} signups={signups} />
  );
  return c.html(`<!DOCTYPE html>${html}`);
});

export default admin;
