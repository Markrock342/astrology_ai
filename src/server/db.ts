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

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
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
