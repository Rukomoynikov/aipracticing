import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import home from "./routes/home";
import waitlist from "./routes/waitlist";
import auth from "./routes/auth";
import admin from "./routes/admin";
import events from "./routes/events";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(logger());
app.use(secureHeaders());

app.route("/", home);
app.route("/", waitlist);
app.route("/", auth);
app.route("/", admin);
app.route("/", events);

app.get("/message", (c) => c.text("Hello Hono!"));

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;
