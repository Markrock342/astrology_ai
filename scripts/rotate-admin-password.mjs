#!/usr/bin/env node
/**
 * Rotate SUPER_ADMIN password in the DB pointed at by DATABASE_URL.
 *
 *   node --env-file=.env scripts/rotate-admin-password.mjs --yes
 *
 * Prints the new password once. Also patches local .env SEED_ADMIN_PASSWORD
 * so a later seed/deploy cannot accidentally use a leaked default.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes");
  process.exit(1);
}

const prisma = new PrismaClient();
const email = process.env.SEED_ADMIN_EMAIL || "admin@horasard.local";
const newPassword = randomBytes(18).toString("base64url");
const passwordHash = await bcrypt.hash(newPassword, 12);

const updated = await prisma.user.update({
  where: { email },
  data: { passwordHash },
  select: { email: true, role: true },
});

if (existsSync(".env")) {
  let env = readFileSync(".env", "utf8");
  if (/^SEED_ADMIN_PASSWORD=.*/m.test(env)) {
    env = env.replace(
      /^SEED_ADMIN_PASSWORD=.*/m,
      `SEED_ADMIN_PASSWORD="${newPassword}"`,
    );
  } else {
    env += `\nSEED_ADMIN_PASSWORD="${newPassword}"\n`;
  }
  writeFileSync(".env", env);
}

console.log(
  JSON.stringify(
    {
      rotated: true,
      email: updated.email,
      role: updated.role,
      newPassword,
      localEnvPatched: true,
      note: "Save this password now — it is not stored in git.",
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
