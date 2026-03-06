import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DB_NAME = "ai-together-signups";

const { stdout, stderr } = await execFileAsync("npx", [
  "wrangler",
  "d1",
  "execute",
  DB_NAME,
  "--local",
  "--file",
  "prisma/bootstrap.sql",
]);

if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

console.log("Local D1 schema initialized from prisma/bootstrap.sql.");
