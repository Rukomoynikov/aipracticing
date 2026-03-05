import { describe, it, expect, vi, beforeAll } from "vitest";
import app from "./index";
import { hashPassword } from "./lib/auth";

// Prevent real AWS SES calls in every test
vi.mock("./lib/ses", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock D1Database.
 *  `firstValues` is a queue consumed by each `.bind().first()` call in order.
 */
function makeDB(firstValues: unknown[] = []) {
  let idx = 0;
  const first = vi
    .fn()
    .mockImplementation(() => Promise.resolve(firstValues[idx++] ?? null));

  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    first,
  };

  return {
    db: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    stmt,
    first,
  };
}

function makeEnv(firstValues: unknown[] = []) {
  const { db, stmt, first } = makeDB(firstValues);
  return {
    env: {
      DB: db,
      ASSETS: {} as Fetcher,
      APP_URL: "https://example.com",
      AWS_REGION: "us-east-1",
      SES_FROM_EMAIL: "no-reply@example.com",
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
    } satisfies CloudflareBindings,
    stmt,
    first,
  };
}

const ctx = {} as ExecutionContext;

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe("GET /", () => {
  it("returns 200 HTML", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(new Request("http://localhost/"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

describe("GET /message", () => {
  it("returns plain-text greeting", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/message"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello Hono!");
  });
});

describe("GET /signup and /login", () => {
  it("GET /signup returns 200 HTML", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/signup"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /login returns 200 HTML", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/login"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /api/auth/signup ─────────────────────────────────────────────────────

describe("POST /api/auth/signup – validation", () => {
  async function post(fields: Record<string, string>) {
    const { env } = makeEnv([null]); // no existing user
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return app.fetch(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
  }

  it("rejects missing name", async () => {
    const res = await post({
      name: "",
      email: "a@b.com",
      password: "password123",
      confirm_password: "password123",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Please enter your name.");
  });

  it("rejects invalid email", async () => {
    const res = await post({
      name: "Alice",
      email: "notanemail",
      password: "password123",
      confirm_password: "password123",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Please enter a valid email.");
  });

  it("rejects short password", async () => {
    const res = await post({
      name: "Alice",
      email: "a@b.com",
      password: "short",
      confirm_password: "short",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Password must be at least 8 characters.");
  });

  it("rejects mismatched passwords", async () => {
    const res = await post({
      name: "Alice",
      email: "a@b.com",
      password: "password123",
      confirm_password: "password456",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Passwords do not match.");
  });

  it("rejects duplicate email", async () => {
    const { env } = makeEnv([{ id: 1 }]); // existing user found
    const body = new FormData();
    body.set("name", "Alice");
    body.set("email", "taken@example.com");
    body.set("password", "password123");
    body.set("confirm_password", "password123");
    const res = await app.fetch(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("already exists");
  });

  it("redirects to /login?check_email=1 on success", async () => {
    const { env } = makeEnv([null]); // no existing user
    const body = new FormData();
    body.set("name", "Alice");
    body.set("email", "new@example.com");
    body.set("password", "password123");
    body.set("confirm_password", "password123");
    const res = await app.fetch(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?check_email=1");
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  let correctHash: string;

  beforeAll(async () => {
    correctHash = await hashPassword("password123");
  });

  async function post(fields: Record<string, string>, firstValues: unknown[] = []) {
    const { env } = makeEnv(firstValues);
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return app.fetch(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
  }

  it("rejects missing fields", async () => {
    const res = await post({ email: "", password: "" });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Please fill in all fields.");
  });

  it("rejects unknown email", async () => {
    const res = await post(
      { email: "nobody@example.com", password: "password123" },
      [null]
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid email or password.");
  });

  it("rejects wrong password", async () => {
    const res = await post(
      { email: "user@example.com", password: "wrongpassword" },
      [{ id: 1, name: "Alice", email: "user@example.com", password_hash: correctHash, confirmed: 1 }]
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Invalid email or password.");
  });

  it("rejects unconfirmed account", async () => {
    const res = await post(
      { email: "user@example.com", password: "password123" },
      [{ id: 1, name: "Alice", email: "user@example.com", password_hash: correctHash, confirmed: 0 }]
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("confirm your email");
  });

  it("redirects to /dashboard on successful login", async () => {
    const res = await post(
      { email: "user@example.com", password: "password123" },
      [{ id: 1, name: "Alice", email: "user@example.com", password_hash: correctHash, confirmed: 1 }]
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
    expect(res.headers.get("Set-Cookie")).toContain("session=");
  });
});

// ── GET /api/auth/confirm ─────────────────────────────────────────────────────

describe("GET /api/auth/confirm", () => {
  it("redirects to /login?error=missing_token when token is absent", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/api/auth/confirm"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=missing_token");
  });

  it("redirects to /login?error=invalid_token for unknown token", async () => {
    const { env } = makeEnv([null]); // user not found
    const res = await app.fetch(
      new Request("http://localhost/api/auth/confirm?token=badtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid_token");
  });

  it("redirects to /dashboard and sets cookie on valid token", async () => {
    const { env } = makeEnv([{ id: 42, confirmed: 0 }]);
    const res = await app.fetch(
      new Request("http://localhost/api/auth/confirm?token=validtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
    expect(res.headers.get("Set-Cookie")).toContain("session=");
  });
});

// ── GET /dashboard ────────────────────────────────────────────────────────────

describe("GET /dashboard – auth guard", () => {
  it("redirects to /login when no session cookie", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/dashboard"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("redirects to /login when session is invalid/expired", async () => {
    const { env } = makeEnv([null]); // getSession returns null
    const res = await app.fetch(
      new Request("http://localhost/dashboard", {
        headers: { Cookie: "session=expiredtoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("returns 200 for a valid session", async () => {
    const { env } = makeEnv([
      { id: 1, name: "Alice", email: "a@b.com", role: "user" },
    ]);
    const res = await app.fetch(
      new Request("http://localhost/dashboard", {
        headers: { Cookie: "session=validtoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});

// ── GET /dashboard/admin ─────────────────────────────────────────────────────

describe("GET /dashboard/admin – role guard", () => {
  it("redirects to /login when not authenticated", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/dashboard/admin"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("redirects to /dashboard when user is not admin", async () => {
    const { env } = makeEnv([
      { id: 1, name: "Alice", email: "a@b.com", role: "user" },
    ]);
    const res = await app.fetch(
      new Request("http://localhost/dashboard/admin", {
        headers: { Cookie: "session=usertoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
  });

  it("returns 200 for admin users", async () => {
    const { env } = makeEnv([
      { id: 2, name: "Admin", email: "admin@b.com", role: "admin" },
    ]);
    const res = await app.fetch(
      new Request("http://localhost/dashboard/admin", {
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /api/admin/events ────────────────────────────────────────────────────

describe("POST /api/admin/events – auth + validation", () => {
  it("redirects to /login when not authenticated", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/api/admin/events", { method: "POST", body: new FormData() }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("redirects to /dashboard for non-admin users", async () => {
    const { env } = makeEnv([
      { id: 1, name: "Alice", email: "a@b.com", role: "user" },
    ]);
    const res = await app.fetch(
      new Request("http://localhost/api/admin/events", {
        method: "POST",
        body: new FormData(),
        headers: { Cookie: "session=usertoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
  });

  async function postAsAdmin(fields: Record<string, string>) {
    const { env } = makeEnv([
      { id: 2, name: "Admin", email: "admin@b.com", role: "admin" },
    ]);
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return app.fetch(
      new Request("http://localhost/api/admin/events", {
        method: "POST",
        body,
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
  }

  it("rejects missing title", async () => {
    const res = await postAsAdmin({
      title: "",
      datetime: "2026-06-01T18:00",
      latitude: "51.5",
      longitude: "-0.1",
      capacity: "50",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Title is required.");
  });

  it("rejects missing location", async () => {
    const res = await postAsAdmin({
      title: "Meetup",
      datetime: "2026-06-01T18:00",
      latitude: "",
      longitude: "",
      capacity: "50",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Please select a location on the map.");
  });

  it("rejects invalid coordinates", async () => {
    const res = await postAsAdmin({
      title: "Meetup",
      datetime: "2026-06-01T18:00",
      latitude: "999",
      longitude: "0",
      capacity: "50",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Latitude must be between");
  });

  it("rejects capacity below 1", async () => {
    const res = await postAsAdmin({
      title: "Meetup",
      datetime: "2026-06-01T18:00",
      latitude: "51.5",
      longitude: "-0.1",
      capacity: "0",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Capacity must be at least 1.");
  });

  it("redirects to /dashboard/admin on success", async () => {
    const { env } = makeEnv([
      { id: 2, name: "Admin", email: "admin@b.com", role: "admin" },
    ]);
    const body = new FormData();
    body.set("title", "Meetup");
    body.set("datetime", "2026-06-01T18:00");
    body.set("latitude", "51.5");
    body.set("longitude", "-0.1");
    body.set("capacity", "50");
    const res = await app.fetch(
      new Request("http://localhost/api/admin/events", {
        method: "POST",
        body,
        headers: { Cookie: "session=admintoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard/admin");
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("redirects to /login and clears the session cookie", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { Cookie: "session=sometoken" },
      }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    const cookie = res.headers.get("Set-Cookie") ?? "";
    // Cookie should be cleared (max-age=0 or empty value)
    expect(cookie).toMatch(/session=;|session=($|;)/);
  });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────

describe("POST /api/auth/forgot-password", () => {
  it("rejects an invalid email format", async () => {
    const { env } = makeEnv();
    const body = new FormData();
    body.set("email", "notanemail");
    const res = await app.fetch(
      new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Please enter a valid email.");
  });

  it("returns 200 even when email is not registered (prevents enumeration)", async () => {
    const { env } = makeEnv([null]); // user not found
    const body = new FormData();
    body.set("email", "nobody@example.com");
    const res = await app.fetch(
      new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────

describe("POST /api/auth/reset-password – validation", () => {
  async function post(fields: Record<string, string>, firstValues: unknown[] = []) {
    const { env } = makeEnv(firstValues);
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return app.fetch(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        body,
      }),
      env,
      ctx
    );
  }

  it("rejects short password", async () => {
    const res = await post({ token: "tok", password: "short", confirm_password: "short" });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("at least 8 characters");
  });

  it("rejects mismatched passwords", async () => {
    const res = await post({
      token: "tok",
      password: "password123",
      confirm_password: "password456",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Passwords do not match.");
  });

  it("rejects invalid/expired token", async () => {
    const res = await post(
      { token: "expiredtoken", password: "password123", confirm_password: "password123" },
      [null] // user not found for this token
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("invalid or has expired");
  });

  it("redirects to /login?confirmed=1 on success", async () => {
    const res = await post(
      { token: "validtoken", password: "password123", confirm_password: "password123" },
      [{ id: 5 }] // valid user found
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?confirmed=1");
  });
});

// ── 404 and error handlers ────────────────────────────────────────────────────

describe("404 handler", () => {
  it("returns JSON with 404 status for unknown routes", async () => {
    const { env } = makeEnv();
    const res = await app.fetch(
      new Request("http://localhost/this-does-not-exist"),
      env,
      ctx
    );
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Not Found");
  });
});
