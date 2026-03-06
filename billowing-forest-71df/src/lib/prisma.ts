import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "../generated/prisma/client";

const prismaByDb = new WeakMap<D1Database, PrismaClient>();

export type AppPrismaClient = PrismaClient;

export function getPrisma(db: D1Database): PrismaClient {
  const cached = prismaByDb.get(db);
  if (cached) return cached;

  const prisma = new PrismaClient({
    adapter: new PrismaD1(db),
  });
  prismaByDb.set(db, prisma);
  return prisma;
}
