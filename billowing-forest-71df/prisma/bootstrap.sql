CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  confirmed INTEGER DEFAULT 0,
  confirmation_token TEXT,
  reset_token TEXT,
  reset_token_expires TEXT,
  created_at TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  datetime TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  capacity INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  location_name TEXT
);

CREATE TABLE IF NOT EXISTS event_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  confirmation_token TEXT,
  confirmed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT NOT NULL,
  interest TEXT,
  created_at TEXT NOT NULL,
  source_ip TEXT,
  user_agent TEXT,
  confirmation_token TEXT,
  confirmed INTEGER DEFAULT 0
);
