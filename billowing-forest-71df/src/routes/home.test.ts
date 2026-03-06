import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import home from "./home";

vi.mock("../lib/ses", () => ({ sendEmail: vi.fn() }));

// first() calls in home route (no session cookie):
//   #1 nextEvent query
// first() calls with session cookie:
//   #1 getSession, #2 nextEvent, #3 isSignedUp check (only when user+event both non-null)
function makeDB(firstValues: unknown[] = []) {
  let fi = 0;
  const first = vi.fn().mockImplementation(() => Promise.resolve(firstValues[fi++] ?? null));
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first,
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
  return { db: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database };
}

function makeEnv(firstValues: unknown[] = []) {
  const { db } = makeDB(firstValues);
  return {
    env: {
      DB: db,
      ASSETS: {} as Fetcher,
      APP_URL: "https://example.com",
      AWS_REGION: "us-east-1",
      SES_FROM_EMAIL: "no-reply@example.com",
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
      GOOGLE_MAPS_API_KEY: "",
    } satisfies CloudflareBindings,
  };
}

function makeApp() {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.route("/", home);
  return app;
}

const ctx = {} as ExecutionContext;

describe("GET /", () => {
  it("returns 200 with HTML content-type", async () => {
    const { env } = makeEnv([null]); // nextEvent = null
    const res = await makeApp().fetch(new Request("http://localhost/"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("renders without error when there is no upcoming event (unauthenticated)", async () => {
    const { env } = makeEnv([null]); // nextEvent = null
    const res = await makeApp().fetch(new Request("http://localhost/"), env, ctx);
    expect(res.status).toBe(200);
  });

  it("shows the upcoming event title when an event exists", async () => {
    const { env } = makeEnv([
      {
        id: 1,
        title: "June Meetup",
        description: "Fun event",
        datetime: "2026-06-01T18:00:00Z",
        capacity: 50,
        latitude: 51.5,
        longitude: -0.1,
        location_name: "Central London",
        signupCount: 10,
      },
    ]);
    const res = await makeApp().fetch(new Request("http://localhost/"), env, ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("June Meetup");
  });

  it("renders without error for an authenticated user with no upcoming event", async () => {
    const { env } = makeEnv([
      { id: 1, name: "Alice", email: "alice@example.com", role: "user" }, // getSession
      null, // nextEvent
    ]);
    const res = await makeApp().fetch(
      new Request("http://localhost/", { headers: { Cookie: "session=tok" } }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });

  it("checks isSignedUp when an authenticated user and upcoming event both exist", async () => {
    const { env } = makeEnv([
      { id: 1, name: "Alice", email: "alice@example.com", role: "user" }, // getSession
      {
        id: 1,
        title: "June Meetup",
        description: null,
        datetime: "2026-06-01T18:00:00Z",
        capacity: 50,
        latitude: 51.5,
        longitude: -0.1,
        location_name: null,
        signupCount: 10,
      }, // nextEvent
      { id: 5 }, // isSignedUp → true
    ]);
    const res = await makeApp().fetch(
      new Request("http://localhost/", { headers: { Cookie: "session=tok" } }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});
