/**
 * One-time migration: move seed Gemini configs from env secretReference
 * (GEMINI_API_KEY) onto encryptedApiKey, clear secretReference, and restore
 * FREE/PRO/ALL plan scopes.
 *
 * Usage: npx tsx scripts/migrate-ai-config-keys.ts
 * Never logs plaintext keys.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  encryptSecret,
  isEncryptionConfigured,
  last4,
} from "../src/lib/crypto/secret-box";

const SCOPE_BY_ID: Record<string, "ALL" | "FREE" | "PRO"> = {
  "seed-gemini-default": "ALL",
  "seed-gemini-free": "FREE",
  "seed-gemini-pro": "PRO",
};

async function main() {
  if (!isEncryptionConfigured()) {
    throw new Error("AI_SECRET_ENC_KEY is required to migrate encrypted API keys");
  }
  const plain = process.env.GEMINI_API_KEY?.trim();
  if (!plain) {
    throw new Error("GEMINI_API_KEY is required to migrate legacy seed configs");
  }

  const prisma = new PrismaClient();
  try {
    const targets = await prisma.aIProviderConfig.findMany({
      where: {
        id: { in: Object.keys(SCOPE_BY_ID) },
      },
      select: {
        id: true,
        displayName: true,
        encryptedApiKey: true,
        secretReference: true,
        planScope: true,
      },
    });

    console.log(`[migrate-ai-keys] found ${targets.length} seed config(s)`);
    let updated = 0;
    for (const row of targets) {
      const planScope = SCOPE_BY_ID[row.id];
      const needsKey = !row.encryptedApiKey;
      const needsScope = row.planScope !== planScope;
      const needsClearRef = row.secretReference != null;
      if (!needsKey && !needsScope && !needsClearRef) {
        console.log(`[migrate-ai-keys] skip ${row.id} (already migrated)`);
        continue;
      }

      await prisma.aIProviderConfig.update({
        where: { id: row.id },
        data: {
          ...(needsKey
            ? {
                encryptedApiKey: encryptSecret(plain),
                keyLast4: last4(plain),
              }
            : {}),
          secretReference: null,
          planScope,
        },
      });
      updated += 1;
      console.log(
        `[migrate-ai-keys] updated ${row.id} scope=${planScope} hasStoredKey=true keyLast4=••••${last4(plain)}`,
      );
    }
    console.log(`[migrate-ai-keys] done — updated ${updated} row(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[migrate-ai-keys] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
