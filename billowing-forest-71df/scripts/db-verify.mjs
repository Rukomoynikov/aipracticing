import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DB_NAME = "ai-together-signups";
const mode = process.argv[2] === "remote" ? "remote" : "local";
const modeFlag = mode === "remote" ? "--remote" : "--local";

async function runQuery(sql) {
  const { stdout, stderr } = await execFileAsync("npx", [
    "wrangler",
    "d1",
    "execute",
    DB_NAME,
    modeFlag,
    "--command",
    sql,
    "--json",
  ]);

  if (stderr) process.stderr.write(stderr);

  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0].success) {
    throw new Error(`Query failed: ${sql}`);
  }
  return parsed[0].results ?? [];
}

async function assertColumn(table, column) {
  const rows = await runQuery(`PRAGMA table_info(${table});`);
  const found = rows.some((row) => row.name === column);
  if (!found) {
    throw new Error(`Missing required column: ${table}.${column}`);
  }
}

await assertColumn("events", "location_name");
await assertColumn("signups", "confirmation_token");
await assertColumn("signups", "confirmed");

console.log(`D1 schema verification passed for ${mode}.`);
