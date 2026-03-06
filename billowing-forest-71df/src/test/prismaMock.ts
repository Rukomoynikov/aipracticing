import { vi } from "vitest";
import type { AppPrismaClient } from "../lib/prisma";

type Row = Record<string, unknown>;

function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (value === true || value === false) return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return Boolean(value);
}

function normalizeUser(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const row = { ...(value as Row) };
  if ("password_hash" in row) row.passwordHash = row.password_hash;
  if ("confirmation_token" in row) row.confirmationToken = row.confirmation_token;
  if ("reset_token" in row) row.resetToken = row.reset_token;
  if ("reset_token_expires" in row) row.resetTokenExpires = row.reset_token_expires;
  if ("created_at" in row) row.createdAt = row.created_at;
  if ("confirmed" in row) row.confirmed = toBool(row.confirmed);
  return row;
}

function normalizeEvent(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const row = { ...(value as Row) };
  if ("datetime" in row) row.dateTime = row.datetime;
  if ("location_name" in row) row.locationName = row.location_name;
  if ("created_at" in row) row.createdAt = row.created_at;
  if ("created_by" in row) row.createdBy = row.created_by;
  if ("signupCount" in row && !("_count" in row)) {
    row._count = { signups: Number(row.signupCount ?? 0) };
  }
  return row;
}

function normalizeEventSignup(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const row = { ...(value as Row) };
  if ("event_id" in row) row.eventId = row.event_id;
  if ("user_id" in row) row.userId = row.user_id;
  if ("confirmation_token" in row) row.confirmationToken = row.confirmation_token;
  if ("created_at" in row) row.createdAt = row.created_at;
  if ("confirmed" in row) row.confirmed = toBool(row.confirmed);
  if ("title" in row && "datetime" in row && !("event" in row)) {
    row.event = {
      title: String(row.title),
      dateTime: String(row.datetime),
    };
  }
  return row;
}

function normalizeSignup(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const row = { ...(value as Row) };
  if ("created_at" in row) row.createdAt = row.created_at;
  if ("source_ip" in row) row.sourceIp = row.source_ip;
  if ("user_agent" in row) row.userAgent = row.user_agent;
  if ("confirmation_token" in row) row.confirmationToken = row.confirmation_token;
  if ("confirmed" in row) row.confirmed = toBool(row.confirmed);
  return row;
}

function normalizeSession(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const row = { ...(value as Row) };
  if ("expires_at" in row) row.expiresAt = row.expires_at;
  if ("created_at" in row) row.createdAt = row.created_at;

  if (!("user" in row) && "id" in row && "email" in row) {
    return { user: normalizeUser(row) };
  }

  if ("user" in row) {
    return {
      ...row,
      user: normalizeUser(row.user),
    };
  }

  return row;
}

function normalizeSingle(model: string, value: unknown): unknown {
  if (model === "user") return normalizeUser(value);
  if (model === "event") return normalizeEvent(value);
  if (model === "eventSignup") return normalizeEventSignup(value);
  if (model === "signup") return normalizeSignup(value);
  if (model === "session") return normalizeSession(value);
  return value;
}

function normalizeMany(model: string, value: unknown[]): unknown[] {
  return value.map((item) => normalizeSingle(model, item));
}

export function createPrismaMock(firstValues: unknown[] = [], allValues: unknown[][] = []) {
  let firstIdx = 0;
  let allIdx = 0;

  const nextSingle = (model: string, fallback: unknown = null) =>
    Promise.resolve(
      normalizeSingle(model, firstValues[firstIdx++] ?? fallback)
    );
  const nextMany = (model: string) =>
    Promise.resolve(normalizeMany(model, allValues[allIdx++] ?? []));

  const writeResult = Promise.resolve({});
  const writeManyResult = Promise.resolve({ count: 1 });

  const prisma = {
    user: {
      findFirst: vi.fn(() => nextSingle("user")),
      findUnique: vi.fn(() => nextSingle("user")),
      create: vi.fn(() => writeResult),
      update: vi.fn(() => writeResult),
      updateMany: vi.fn(() => writeManyResult),
      deleteMany: vi.fn(() => writeManyResult),
    },
    session: {
      findFirst: vi.fn(() => nextSingle("session")),
      findUnique: vi.fn(() => nextSingle("session")),
      create: vi.fn(() => writeResult),
      update: vi.fn(() => writeResult),
      deleteMany: vi.fn(() => writeManyResult),
    },
    event: {
      findFirst: vi.fn(() => nextSingle("event")),
      findMany: vi.fn(() => nextMany("event")),
      create: vi.fn(() => writeResult),
      update: vi.fn(() => writeResult),
      deleteMany: vi.fn(() => writeManyResult),
    },
    eventSignup: {
      findFirst: vi.fn(() => nextSingle("eventSignup")),
      findMany: vi.fn(() => nextMany("eventSignup")),
      create: vi.fn(() => writeResult),
      update: vi.fn(() => writeResult),
      deleteMany: vi.fn(() => writeManyResult),
    },
    signup: {
      findFirst: vi.fn(() => nextSingle("signup")),
      findMany: vi.fn(() => nextMany("signup")),
      create: vi.fn(() => writeResult),
      update: vi.fn(() => writeResult),
      deleteMany: vi.fn(() => writeManyResult),
    },
  };

  return prisma as unknown as AppPrismaClient;
}
