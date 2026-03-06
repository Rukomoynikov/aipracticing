import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import auth from "./auth";

vi.mock("../lib/ses", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

// first() call order varies by route — documented per describe block.
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
  app.route("/", auth);
  return app;
}

const ctx = {} as ExecutionContext;

// ── GET /signup ───────────────────────────────────────────────────────────────

describe("GET /signup", () => {
  it("returns 200 HTML", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(new Request("http://localhost/signup"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

// ── GET /login query param variations ────────────────────────────────────────

describe("GET /login", () => {
  it("returns 200 HTML for bare /login", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(new Request("http://localhost/login"), env, ctx);
    expect(res.status).toBe(200);
  });

  it("shows error message for ?error=invalid_token", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/login?error=invalid_token"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("invalid or has already been used");
  });

  it("shows error message for ?error=missing_token", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/login?error=missing_token"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("No confirmation token provided.");
  });

  it("renders without error for ?confirmed=1", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/login?confirmed=1"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });

  it("shows check-inbox banner for ?check_email=1", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/login?check_email=1"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Check your inbox");
  });
});

// ── GET /forgot-password ──────────────────────────────────────────────────────

describe("GET /forgot-password", () => {
  it("returns 200 HTML", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(new Request("http://localhost/forgot-password"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

// ── GET /reset-password ───────────────────────────────────────────────────────
// first() calls:
//   #1 user lookup by reset_token

describe("GET /reset-password", () => {
  it("shows error page when no token query param is provided", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(new Request("http://localhost/reset-password"), env, ctx);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid or missing reset token");
  });

  it("shows error page when the token is invalid or expired", async () => {
    const { env } = makeEnv([null]); // no user found for this token
    const res = await makeApp().fetch(
      new Request("http://localhost/reset-password?token=expiredtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("invalid or has expired");
  });

  it("returns 200 with the reset-password form for a valid token", async () => {
    const { env } = makeEnv([{ id: 5 }]); // valid user found
    const res = await makeApp().fetch(
      new Request("http://localhost/reset-password?token=validtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

// ── GET /dashboard – auth guard ───────────────────────────────────────────────
// first() calls:
//   #1 getSession

describe("GET /dashboard", () => {
  it("redirects to /login when no session cookie", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(new Request("http://localhost/dashboard"), env, ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("redirects to /login when session is invalid", async () => {
    const { env } = makeEnv([null]); // getSession returns null
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard", { headers: { Cookie: "session=bad" } }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("returns 200 for a valid session", async () => {
    const { env } = makeEnv([{ id: 1, name: "Alice", email: "a@b.com", role: "user" }]);
    const res = await makeApp().fetch(
      new Request("http://localhost/dashboard", { headers: { Cookie: "session=tok" } }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});
