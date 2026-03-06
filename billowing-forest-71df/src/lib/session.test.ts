import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { SESSION_COOKIE, SESSION_MAX_AGE, setSessionCookie, clearSessionCookie } from "./session";

describe("constants", () => {
  it("SESSION_COOKIE is 'session'", () => {
    expect(SESSION_COOKIE).toBe("session");
  });

  it("SESSION_MAX_AGE is 7 days in seconds", () => {
    expect(SESSION_MAX_AGE).toBe(7 * 24 * 60 * 60);
  });
});

describe("setSessionCookie", () => {
  it("sets a secure HttpOnly SameSite=Lax cookie with the token and max-age", async () => {
    const app = new Hono();
    app.get("/", (c) => {
      setSessionCookie(c, "tok123");
      return c.text("ok");
    });
    const res = await app.fetch(new Request("http://localhost/"));
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("session=tok123");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("secure");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE}`);
    expect(cookie).toContain("Path=/");
  });
});

describe("clearSessionCookie", () => {
  it("sets the session cookie to empty with Max-Age=0", async () => {
    const app = new Hono();
    app.get("/", (c) => {
      clearSessionCookie(c);
      return c.text("ok");
    });
    const res = await app.fetch(new Request("http://localhost/"));
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/session=($|;)/);
    expect(cookie).toContain("Max-Age=0");
  });
});
