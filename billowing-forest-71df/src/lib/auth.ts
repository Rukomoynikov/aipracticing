const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_LENGTH * 8
  );
  const hash = new Uint8Array(hashBits);
  const combined = new Uint8Array(SALT_LENGTH + HASH_LENGTH);
  combined.set(salt);
  combined.set(hash, SALT_LENGTH);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, SALT_LENGTH);
    const storedHash = combined.slice(SALT_LENGTH);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const hashBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      HASH_LENGTH * 8
    );
    const hash = new Uint8Array(hashBits);
    // Constant-time comparison
    if (hash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) {
      diff |= hash[i] ^ storedHash[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
    .bind(userId, token, expiresAt, createdAt)
    .run();
  return token;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
}

export async function getSession(
  db: D1Database,
  token: string
): Promise<{ id: number; name: string; email: string; role: string } | null> {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT u.id, u.name, u.email, COALESCE(u.role, 'user') as role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?1 AND s.expires_at > ?2 AND u.confirmed = 1
       LIMIT 1`
    )
    .bind(token, now)
    .first<{ id: number; name: string; email: string; role: string }>();
  return row ?? null;
}
