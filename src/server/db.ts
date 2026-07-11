import { statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaClientMarker: string | undefined;
};

function generatedClientMarker(): string {
  try {
    return String(
      statSync(join(process.cwd(), "node_modules/.prisma/client/index.js")).mtimeMs,
    );
  } catch {
    return "0";
  }
}

/** Serverless-friendly URL: one connection per lambda via PgBouncer. */
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  if (/[?&]connection_limit=/.test(raw)) return raw;
  return raw.includes("?")
    ? `${raw}&connection_limit=1`
    : `${raw}?connection_limit=1`;
}

function createPrismaClient(): PrismaClient {
  const url = databaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

/**
 * Prisma client singleton. Avoids exhausting DB connections during Next.js
 * hot-reload in development. In dev, recreates the client after
 * `prisma generate` so stale DMMF (e.g. missing new columns) cannot linger.
 */
function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }

  const marker = generatedClientMarker();
  if (globalForPrisma.prisma && globalForPrisma.prismaClientMarker === marker) {
    return globalForPrisma.prisma;
  }

  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect();
  }

  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.prismaClientMarker = marker;
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
