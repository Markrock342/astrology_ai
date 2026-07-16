import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import { aiConfigTestKeySchema } from "@/lib/admin-schemas";
import { GeminiAdapter } from "@/server/ai/providers/gemini";
import { OpenAIAdapter } from "@/server/ai/providers/openai";

/**
 * POST /api/admin/ai-configs/test-key — fire a short real request with a raw
 * API key the admin typed in, WITHOUT saving it. Used to verify the key works
 * before committing encrypt-and-store.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();

    const body = aiConfigTestKeySchema.parse(await req.json());
    const adapter =
      body.provider === "OPENAI" ? new OpenAIAdapter() : new GeminiAdapter();

    const result = await adapter.generate({
      modelId: body.modelId,
      systemPrompt: "คุณคือผู้ช่วยทดสอบระบบ ตอบสั้นๆ 1 ประโยค",
      userPrompt: "ทดสอบการเชื่อมต่อ: ทักทายเป็นภาษาไทยสั้นๆ",
      temperature: 0.2,
      maxOutputTokens: 64,
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
