import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(secureHeaders());

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
