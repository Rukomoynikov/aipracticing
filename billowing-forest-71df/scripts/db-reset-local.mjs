import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DB_NAME = "ai-together-signups";
const DROP_SQL = `
DROP TABLE IF EXISTS event_signups;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS signups;
DROP TABLE IF EXISTS users;
`;

await execFileAsync(
  "npx",
  ["wrangler", "d1", "execute", DB_NAME, "--local", "--command", DROP_SQL],
  { stdio: "inherit" }
);

console.log("Local D1 tables were reset.");
