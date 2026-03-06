import { describe, it, expect, vi } from "vitest";
import { ensureTables } from "./db";

function makeDB() {
  const stmt = {
    run: vi.fn().mockResolvedValue({ success: true }),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
  return {
    db: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    stmt,
  };
}

describe("ensureTables", () => {
  it("creates users, sessions, events, and event_signups tables", async () => {
    const { db } = makeDB();
    await ensureTables(db);
    const sqls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.map(([s]: [string]) => s);
    expect(sqls.some(s => s.includes("CREATE TABLE IF NOT EXISTS users"))).toBe(true);
    expect(sqls.some(s => s.includes("CREATE TABLE IF NOT EXISTS sessions"))).toBe(true);
    expect(sqls.some(s => s.includes("CREATE TABLE IF NOT EXISTS events"))).toBe(true);
    expect(sqls.some(s => s.includes("CREATE TABLE IF NOT EXISTS event_signups"))).toBe(true);
  });

  it("runs ALTER TABLE migrations for role and location_name columns", async () => {
    const { db } = makeDB();
    await ensureTables(db);
    const sqls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.map(([s]: [string]) => s);
    expect(sqls.some(s => s.includes("ADD COLUMN role"))).toBe(true);
    expect(sqls.some(s => s.includes("ADD COLUMN location_name"))).toBe(true);
  });

  it("does not throw when ALTER TABLE fails (columns already exist)", async () => {
    const normalStmt = {
      run: vi.fn().mockResolvedValue({ success: true }),
      bind: vi.fn().mockReturnThis(),
    };
    const throwStmt = {
      run: vi.fn().mockRejectedValue(new Error("duplicate column name")),
      bind: vi.fn().mockReturnThis(),
    };
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) =>
        sql.startsWith("ALTER TABLE") ? throwStmt : normalStmt
      ),
    } as unknown as D1Database;

    await expect(ensureTables(db)).resolves.toBeUndefined();
  });
});
