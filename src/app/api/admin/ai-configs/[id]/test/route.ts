import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { AppError } from "@/lib/errors";
import {
  aiConfigDiscoverSavedModelsSchema,
  aiConfigRunTestSchema,
} from "@/lib/admin-schemas";
import { prisma } from "@/server/db";
import { generateOnce } from "@/server/ai/router";
import { assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import { resolveApiKey } from "@/server/ai/secret-resolver";
import { discoverProviderModels } from "@/server/ai/provider-model-discovery";

/**
 * POST /api/admin/ai-configs/:id/test — fire a short real request at the model
 * so an admin can verify the config works. No credit charge, no reading saved.
 * Tests the primary config only (no fallback) so a broken primary cannot pass.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    const { id } = await ctx.params;

    const config = await prisma.aIProviderConfig.findUnique({ where: { id } });
    if (!config) throw new AppError("NOT_FOUND", "AI config not found");
    const rawBody = await req.text();
    const json = rawBody ? JSON.parse(rawBody) : {};

    if (json?.action === "discover") {
      aiConfigDiscoverSavedModelsSchema.parse(json);
      const apiKey = await resolveApiKey(config);
      if (!apiKey) {
        throw new AppError("AI_PROVIDER_ERROR", "API key not configured");
      }
      return ok(
        await discoverProviderModels({
          provider: config.provider,
          baseUrl: config.baseUrl,
          apiKey,
        }),
      );
    }

    const body = aiConfigRunTestSchema.parse(json);

    const result = await generateOnce(id, {
      systemPrompt: "คุณคือผู้ช่วยทดสอบระบบ ตอบสั้นๆ 1 ประโยค",
      userPrompt: "ทดสอบการเชื่อมต่อ: ทักทายเป็นภาษาไทยสั้นๆ",
      timeoutMs: body.timeoutMs,
    });

    return ok({
      ok: result.ok,
      provider: result.provider,
      modelId: result.modelId,
      latencyMs: result.latencyMs,
      reply: result.rawText?.slice(0, 500) ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      usedFallback: false,
    });
  });
}
