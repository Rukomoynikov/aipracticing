import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import events from "./events";
import { getPrisma } from "../lib/prisma";
import { createPrismaMock } from "../test/prismaMock";

vi.mock("../lib/ses", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/prisma", () => ({ getPrisma: vi.fn() }));

// first() call order for POST /api/events/:eventId/signup (no session cookie):
//   #1 event query
//   #2 existing signup check
// first() call order with session cookie:
//   #1 event query
//   #2 getSession
//   #3 existing signup check
//
// first() call order for GET /api/events/confirm:
//   #1 signup + event join query
function makeEnv(firstValues: unknown[] = []) {
  const prisma = createPrismaMock(firstValues);
  vi.mocked(getPrisma).mockReturnValue(prisma);

  return {
    env: {
      DB: {} as D1Database,
      ASSETS: {} as Fetcher,
      APP_URL: "https://example.com",
      AWS_REGION: "us-east-1",
      SES_FROM_EMAIL: "no-reply@example.com",
      AWS_ACCESS_KEY_ID: "test-key",
      AWS_SECRET_ACCESS_KEY: "test-secret",
      GOOGLE_MAPS_API_KEY: "",
    } satisfies CloudflareBindings,
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.route("/", events);
  return app;
}

const ctx = {} as ExecutionContext;

const openEvent = {
  id: 1,
  title: "June Meetup",
  datetime: "2026-06-01T18:00:00Z",
  capacity: 50,
  signupCount: 10,
};
const fullEvent = { ...openEvent, signupCount: 50 };

// ── POST /api/events/:eventId/signup ──────────────────────────────────────────

describe("POST /api/events/:eventId/signup", () => {
  async function post(
    eventId: string | number,
    fields: Record<string, string>,
    firstValues: unknown[] = [],
    cookie?: string
  ) {
    const { env } = makeEnv(firstValues);
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    const headers: Record<string, string> = {};
    if (cookie) headers["Cookie"] = cookie;
    return makeApp().fetch(
      new Request(`http://localhost/api/events/${eventId}/signup`, {
        method: "POST",
        body,
        headers,
      }),
      env,
      ctx
    );
  }

  it("returns 400 for a non-numeric event ID", async () => {
    const res = await post("abc", { name: "Alice", email: "a@b.com" });
    expect(res.status).toBe(400);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.error).toContain("Invalid event ID");
  });

  it("returns 404 when the event is not found", async () => {
    const res = await post(999, { name: "Alice", email: "a@b.com" }, [null]);
    expect(res.status).toBe(404);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.error).toContain("not found");
  });

  it("returns 400 when the event is fully booked", async () => {
    const res = await post(1, { name: "Alice", email: "a@b.com" }, [fullEvent]);
    expect(res.status).toBe(400);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.error).toContain("fully booked");
  });

  it("returns 400 when name is missing", async () => {
    // no cookie → firstValues: event, existing
    const res = await post(1, { name: "", email: "a@b.com" }, [openEvent, null]);
    expect(res.status).toBe(400);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.error).toContain("name");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await post(1, { name: "Alice", email: "notanemail" }, [openEvent, null]);
    expect(res.status).toBe(400);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.error).toContain("valid email");
  });

  it("returns success when user is already confirmed for the event", async () => {
    // no cookie → firstValues: event, existing (confirmed)
    const res = await post(
      1,
      { name: "Alice", email: "a@b.com" },
      [openEvent, { id: 5, confirmed: 1 }]
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain("already signed up");
  });

  it("sends confirmation email and returns check-inbox message for unauthenticated user", async () => {
    // no cookie → firstValues: event, existing (null)
    const res = await post(
      1,
      { name: "Bob", email: "bob@example.com" },
      [openEvent, null]
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain("inbox");
  });

  it("directly signs up an authenticated user without email confirmation", async () => {
    // with cookie → firstValues: event, getSession, existing (null)
    const res = await post(
      1,
      { name: "Alice", email: "alice@example.com" },
      [
        openEvent,
        { id: 1, name: "Alice", email: "alice@example.com", role: "user" }, // getSession
        null, // no existing signup
      ],
      "session=validtoken"
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).not.toContain("inbox");
  });

  it("updates an existing unconfirmed signup for an authenticated user", async () => {
    // with cookie → firstValues: event, getSession, existing (unconfirmed)
    const res = await post(
      1,
      { name: "Alice", email: "alice@example.com" },
      [
        openEvent,
        { id: 1, name: "Alice", email: "alice@example.com", role: "user" },
        { id: 10, confirmed: 0 }, // existing unconfirmed signup
      ],
      "session=validtoken"
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
  });
});

// ── GET /api/events/confirm ───────────────────────────────────────────────────

describe("GET /api/events/confirm", () => {
  it("returns 400 when no token is provided", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/api/events/confirm"),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("No confirmation token provided.");
  });

  it("returns 400 for an invalid or already-used token", async () => {
    const { env } = makeEnv([null]); // signup not found
    const res = await makeApp().fetch(
      new Request("http://localhost/api/events/confirm?token=badtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("invalid or has already been used");
  });

  it("returns 200 confirmation page with event details for a valid token", async () => {
    const { env } = makeEnv([
      {
        id: 5,
        event_id: 1,
        confirmed: 0,
        title: "June Meetup",
        datetime: "2026-06-01T18:00:00Z",
      },
    ]);
    const res = await makeApp().fetch(
      new Request("http://localhost/api/events/confirm?token=validtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("confirmed");
    expect(body).toContain("June Meetup");
  });

  it("still returns 200 if signup was already confirmed", async () => {
    const { env } = makeEnv([
      {
        id: 5,
        event_id: 1,
        confirmed: 1,
        title: "June Meetup",
        datetime: "2026-06-01T18:00:00Z",
      },
    ]);
    const res = await makeApp().fetch(
      new Request("http://localhost/api/events/confirm?token=usedtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});
