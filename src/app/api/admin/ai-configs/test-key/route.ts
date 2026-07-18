import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import {
  aiConfigDiscoverModelsSchema,
  aiConfigTestKeySchema,
} from "@/lib/admin-schemas";
import { GeminiAdapter } from "@/server/ai/providers/gemini";
import { OpenAIAdapter } from "@/server/ai/providers/openai";
import { discoverProviderModels } from "@/server/ai/provider-model-discovery";

/**
 * POST /api/admin/ai-configs/test-key — fire a short real request with a raw
 * API key the admin typed in, WITHOUT saving it. Used to verify the key works
 * before committing encrypt-and-store.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();

    const json = await req.json();
    if (json?.action === "discover") {
      const body = aiConfigDiscoverModelsSchema.parse(json);
      return ok(
        await discoverProviderModels({
          provider: body.provider,
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
        }),
      );
    }

    const body = aiConfigTestKeySchema.parse(json);
    const adapter =
      body.provider === "OPENAI" ? new OpenAIAdapter() : new GeminiAdapter();

    const result = await adapter.generate({
      modelId: body.modelId,
      systemPrompt: "คุณคือผู้ช่วยทดสอบระบบ ตอบสั้นๆ 1 ประโยค",
      userPrompt: "ทดสอบการเชื่อมต่อ: ทักทายเป็นภาษาไทยสั้นๆ",
      temperature: 0.2,
      // Reasoning models (o1/o3/gpt-5) spend their whole budget on hidden
      // reasoning, so a 64-token probe returned empty and tested red. 512 leaves
      // room for the reasoning pass plus a one-line reply.
      maxOutputTokens: 512,
      timeoutMs: 20_000,
      baseUrl: body.baseUrl ?? undefined,
      apiKey: body.apiKey,
    });

    return ok({
      ok: result.ok,
      provider: result.provider,
      modelId: result.modelId,
      latencyMs: result.latencyMs,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      preview: result.ok ? (result.rawText?.slice(0, 120) ?? null) : null,
    });
  });
}
