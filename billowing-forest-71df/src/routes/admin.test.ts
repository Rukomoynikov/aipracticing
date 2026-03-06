import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import admin from "./admin";

vi.mock("../lib/ses", () => ({ sendEmail: vi.fn() }));

// first() calls order documented per describe block.
function makeDB(firstValues: unknown[] = [], allValues: unknown[][] = []) {
  let fi = 0;
  let ai = 0;
  const first = vi.fn().mockImplementation(() => Promise.resolve(firstValues[fi++] ?? null));
  const all = vi.fn().mockImplementation(() => Promise.resolve({ results: allValues[ai++] ?? [] }));
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first,
    all,
  };
  return { db: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database };
}

function makeEnv(firstValues: unknown[] = [], allValues: unknown[][] = []) {
  const { db } = makeDB(firstValues, allValues);
  return {
    env: {
      DB: db,
      ASSETS: {} as Fetcher,
      APP_URL: "https://example.com",
      AWS_REGION: "us-east-1",
      SES_FROM_EMAIL: "no-reply@example.com",
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
      GOOGLE_MAPS_API_KEY: "test-maps-key",
    } satisfies CloudflareBindings,
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.route("/", admin);
  return app;
}

const ctx = {} as ExecutionContext;
const adminUser = { id: 2, name: "Admin", email: "admin@b.com", role: "admin" };
const regularUser = { id: 1, name: "Alice", email: "a@b.com", role: "user" };

// ── GET /dashboard/admin/events/new ──────────────────────────────────────────
// first() calls: #1 getSession

describe("GET /dashboard/admin/events/new", () => {
  it("redirects to /login when not authenticated", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/new"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("redirects to /dashboard for non-admin users", async () => {
    const { env } = makeEnv([regularUser]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/new", {
        headers: { Cookie: "session=usertoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
  });

  it("returns 200 with the create-event form for admin", async () => {
    const { env } = makeEnv([adminUser]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/new", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

// ── GET /dashboard/admin ──────────────────────────────────────────────────────
// first() calls: #1 getSession

describe("GET /dashboard/admin", () => {
  it("redirects to /login when not authenticated", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(new Request("http://localhost/dashboard/admin"), env, ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("redirects to /dashboard for non-admin", async () => {
    const { env } = makeEnv([regularUser]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin", { headers: { Cookie: "session=tok" } }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
  });

  it("returns 200 for admin", async () => {
    const { env } = makeEnv([adminUser]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin", { headers: { Cookie: "session=admintoken" } }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});

// ── GET /dashboard/admin/events ───────────────────────────────────────────────
// first() calls: #1 getSession
// all() calls:   #1 events list

describe("GET /dashboard/admin/events", () => {
  it("redirects to /login when not authenticated", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("returns 200 with events list for admin", async () => {
    const { env } = makeEnv(
      [adminUser],
      [[
        { id: 1, title: "June Meetup", datetime: "2026-06-01T18:00:00Z", capacity: 50, signupCount: 12 },
      ]]
    );
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("June Meetup");
  });

  it("shows success banner when ?success= query param is present", async () => {
    const { env } = makeEnv([adminUser], [[]]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events?success=Event%20deleted.", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Event deleted.");
  });
});

// ── GET /dashboard/admin/events/:id/edit ─────────────────────────────────────
// first() calls: #1 getSession, #2 event lookup

describe("GET /dashboard/admin/events/:id/edit", () => {
  it("redirects to events list when event not found", async () => {
    const { env } = makeEnv([adminUser, null]); // event not found
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/999/edit", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard/admin/events");
  });

  it("returns 200 with pre-filled form for an existing event", async () => {
    const { env } = makeEnv([
      adminUser,
      {
        id: 1,
        title: "June Meetup",
        description: "Fun event",
        datetime: "2026-06-01T18:00:00Z",
        latitude: 51.5,
        longitude: -0.1,
        capacity: 50,
        location_name: null,
      },
    ]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/1/edit", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("June Meetup");
    expect(body).toContain("Fun event");
  });
});

// ── POST /api/admin/events/:id/delete ────────────────────────────────────────
// first() calls: #1 getSession

describe("POST /api/admin/events/:id/delete", () => {
  it("redirects to events list with success after deletion", async () => {
    const { env } = makeEnv([adminUser]);
    const res = await makeApp().fetch(
      new Request("http://localhost/api/admin/events/1/delete", {
        method: "POST",
        body: new FormData(),
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard/admin/events?success=Event%20deleted.");
  });
});

// ── GET /dashboard/admin/events/:id/signups ───────────────────────────────────
// first() calls: #1 getSession, #2 event lookup
// all() calls:   #1 signups list

describe("GET /dashboard/admin/events/:id/signups", () => {
  it("redirects to events list when event not found", async () => {
    const { env } = makeEnv([adminUser, null]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/999/signups", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard/admin/events");
  });

  it("returns 200 with signups table for a valid event", async () => {
    const { env } = makeEnv(
      [
        adminUser,
        { id: 1, title: "June Meetup", datetime: "2026-06-01T18:00:00Z", capacity: 50 },
      ],
      [[
        { id: 1, name: "Alice", email: "alice@example.com", confirmed: 1, created_at: "2026-05-01T10:00:00Z" },
        { id: 2, name: "Bob", email: "bob@example.com", confirmed: 0, created_at: "2026-05-02T11:00:00Z" },
      ]]
    );
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard/admin/events/1/signups", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("alice@example.com");
    expect(body).toContain("bob@example.com");
  });
});
