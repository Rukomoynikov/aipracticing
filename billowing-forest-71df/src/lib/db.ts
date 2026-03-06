export async function ensureTables(db: CloudflareBindings["DB"]) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        confirmed INTEGER DEFAULT 0,
        confirmation_token TEXT,
        reset_token TEXT,
        reset_token_expires TEXT,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  // Add role column for existing databases
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'").run();
  } catch {
    // Column already exists — ignore
  }

  // Add location_name column for existing databases
  try {
    await db.prepare("ALTER TABLE events ADD COLUMN location_name TEXT").run();
  } catch {
    // Column already exists — ignore
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        datetime TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        capacity INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS event_signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        confirmation_token TEXT,
        confirmed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`
    )
    .run();
}
