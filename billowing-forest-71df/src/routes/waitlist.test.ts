import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import waitlist from "./waitlist";
import { getPrisma } from "../lib/prisma";
import { createPrismaMock } from "../test/prismaMock";

vi.mock("../lib/ses", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/prisma", () => ({ getPrisma: vi.fn() }));

// first() calls in POST /api/signup:
//   #1 existing signup check
// first() calls in GET /api/confirm:
//   #1 row lookup by token
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
  app.route("/", waitlist);
  return app;
}

const ctx = {} as ExecutionContext;

// ── POST /api/signup ──────────────────────────────────────────────────────────

describe("POST /api/signup", () => {
  async function post(fields: Record<string, string>, firstValues: unknown[] = []) {
    const { env } = makeEnv(firstValues);
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return makeApp().fetch(
      new Request("http://localhost/api/signup", { method: "POST", body }),
      env,
      ctx
    );
  }

  it("rejects a missing or invalid email", async () => {
    const res = await post({ email: "notanemail", name: "Alice" });
    expect(res.status).toBe(400);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toContain("valid email");
  });

  it("rejects an empty email", async () => {
    const res = await post({ email: "", name: "Alice" });
    expect(res.status).toBe(400);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
  });

  it("returns success when email is already confirmed", async () => {
    const res = await post(
      { email: "a@b.com", name: "Alice" },
      [{ id: 1, confirmed: 1 }]
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain("already confirmed");
  });

  it("creates a new signup and returns check-inbox message", async () => {
    const res = await post(
      { email: "new@example.com", name: "Bob" },
      [null] // no existing signup
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain("inbox");
  });

  it("resends confirmation for an existing unconfirmed signup", async () => {
    const res = await post(
      { email: "unconfirmed@example.com", name: "Carol" },
      [{ id: 2, confirmed: 0 }]
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain("inbox");
  });
});

// ── GET /api/confirm ──────────────────────────────────────────────────────────

describe("GET /api/confirm", () => {
  it("returns 400 when no token is provided", async () => {
    const { env } = makeEnv();
    const res = await makeApp().fetch(
      new Request("http://localhost/api/confirm"),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("No confirmation token provided.");
  });

  it("returns 400 for an invalid or already-used token", async () => {
    const { env } = makeEnv([null]); // no row found
    const res = await makeApp().fetch(
      new Request("http://localhost/api/confirm?token=badtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("invalid or has already been used");
  });

  it("returns 200 confirmation page for a valid unconfirmed token", async () => {
    const { env } = makeEnv([{ id: 1, confirmed: 0 }]);
    const res = await makeApp().fetch(
      new Request("http://localhost/api/confirm?token=validtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("confirmed");
  });

  it("returns 200 even when the signup was already confirmed", async () => {
    const { env } = makeEnv([{ id: 1, confirmed: 1 }]);
    const res = await makeApp().fetch(
      new Request("http://localhost/api/confirm?token=usedtoken"),
      env,
      ctx
    );
    expect(res.status).toBe(200);
  });
});
