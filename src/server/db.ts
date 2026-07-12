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

function appendQueryParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return url.includes("?") ? `${url}&${key}=${value}` : `${url}?${key}=${value}`;
}

/**
 * Serverless-friendly URL tuning for Supabase PgBouncer.
 * Warm Vercel instances can serve concurrent requests — connection_limit=1
 * caused pool timeouts when bootstrap, chat poll, and natal compute overlapped.
 */
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  let url = raw;

  const limit =
    process.env.PRISMA_CONNECTION_LIMIT ??
    (process.env.NODE_ENV === "production" ? "5" : "3");
  const timeout = process.env.PRISMA_POOL_TIMEOUT ?? "20";

  if (!/[?&]connection_limit=/.test(url) && limit) {
    url = appendQueryParam(url, "connection_limit", limit);
  }
  if (!/[?&]pool_timeout=/.test(url) && timeout) {
    url = appendQueryParam(url, "pool_timeout", timeout);
  }

  const usesPooler =
    /:6543[/?]/.test(url) ||
    /[?&]pgbouncer=true/.test(url) ||
    /pooler\.supabase\.com/i.test(url);

  if (usesPooler && !/[?&]pgbouncer=/.test(url)) {
    url = appendQueryParam(url, "pgbouncer", "true");
  }

  return url;
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
