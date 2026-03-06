import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { renderToString } from "react-dom/server";
import App from "../App";
import { SESSION_COOKIE } from "../lib/session";
import { getSession } from "../lib/auth";
import { getPrisma } from "../lib/prisma";

const home = new Hono<{ Bindings: CloudflareBindings }>();

home.get("/", async (c) => {
  const prisma = getPrisma(c.env.DB);

  const token = getCookie(c, SESSION_COOKIE);
  const currentUser = token ? await getSession(prisma, token).catch(() => null) : null;
  const isAuthenticated = !!currentUser;

  const nextEventRow = await prisma.event
    .findFirst({
      where: {
        dateTime: {
          gt: new Date().toISOString(),
        },
      },
      orderBy: {
        dateTime: "asc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        dateTime: true,
        capacity: true,
        latitude: true,
        longitude: true,
        locationName: true,
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
    })
    .catch(() => null);

  const nextEvent = nextEventRow
    ? {
        id: nextEventRow.id,
        title: nextEventRow.title,
        description: nextEventRow.description,
        datetime: nextEventRow.dateTime,
        capacity: nextEventRow.capacity,
        latitude: nextEventRow.latitude,
        longitude: nextEventRow.longitude,
        location_name: nextEventRow.locationName,
        signupCount: nextEventRow._count.signups,
      }
    : null;

  let isSignedUp = false;
  if (currentUser && nextEvent) {
    const existing = await prisma.eventSignup
      .findFirst({
        where: {
          eventId: nextEvent.id,
          email: currentUser.email,
        },
        select: {
          id: true,
        },
      })
      .catch(() => null);
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
