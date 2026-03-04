import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { renderToString } from "react-dom/server";
import App from "./App";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(secureHeaders());

app.get("/", (c) => {
  const html = renderToString(<App />);
  return c.html(`<!DOCTYPE html>${html}`);
});

app.post("/api/signup", async (c) => {
  try {
    const formData = await c.req.raw.formData();

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const interest = String(formData.get("interest") || "").trim();

    if (!email || !email.includes("@")) {
      return c.json({ ok: false, error: "Please enter a valid email." }, 400);
    }

    const createdAt = new Date().toISOString();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT NOT NULL,
        interest TEXT,
        created_at TEXT NOT NULL,
        source_ip TEXT,
        user_agent TEXT
      )`
    ).run();

    await c.env.DB.prepare(
      `INSERT INTO signups (name, email, interest, created_at, source_ip, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
      .bind(
        name || null,
        email,
        interest || null,
        createdAt,
        c.req.raw.headers.get("CF-Connecting-IP") || null,
        c.req.raw.headers.get("User-Agent") || null
      )
      .run();

    return c.json({
      ok: true,
      message: "You're on the list — we'll email you the next session details.",
    });
  } catch (error) {
    console.error("Signup error", error);
    return c.json(
      {
        ok: false,
        error:
          "Something went wrong saving your signup. Please try again in a moment, or email us directly.",
      },
      500
    );
  }
});

app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
