import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import App from "../App";
import { ensureTables } from "../lib/db";
import { SESSION_COOKIE } from "../lib/session";
import { getSession } from "../lib/auth";

const home = new Hono<{ Bindings: CloudflareBindings }>();

home.get("/", async (c) => {
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

export default home;
