/** Preview by default. --apply bootstraps an EMPTY, never-curated library only. */
import { PrismaClient } from "@prisma/client";
import { seedKnowledgeSafely } from "../prisma/seed-knowledge-safe";
const prisma = new PrismaClient();
async function main() {
  const result = await seedKnowledgeSafely(prisma, process.argv.includes("--apply"));
  console.log(JSON.stringify(result));
  if (result.status === "preserved") console.log("Existing knowledge, admin history or bootstrap marker found. Documents and enabled states were left untouched.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
