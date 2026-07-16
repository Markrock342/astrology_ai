import "dotenv/config";
import { prisma } from "../src/server/db";
import { generateOnce, resolveConfig } from "../src/server/ai/router";

async function main() {
  const cat = await prisma.horoscopeCategory.findFirst({
    where: { enabled: true },
    select: { id: true, slug: true },
  });
  if (!cat) throw new Error("no category");

  const free = await resolveConfig(cat.id, "FREE");
  const pro = await resolveConfig(cat.id, "PRO");
  console.log(
    JSON.stringify(
      {
        category: cat.slug,
        free: { id: free.id, planScope: free.planScope, modelId: free.modelId },
        pro: { id: pro.id, planScope: pro.planScope, modelId: pro.modelId },
      },
      null,
      2,
    ),
  );

  const probe = await generateOnce(pro.id, {
    systemPrompt: "ตอบสั้น",
    userPrompt: "สวัสดี",
    timeoutMs: 12_000,
    maxOutputTokens: 32,
  });
  console.log(
    JSON.stringify(
      {
        probeOk: probe.ok,
        modelId: probe.modelId,
        latencyMs: probe.latencyMs,
        errorCode: probe.errorCode ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
