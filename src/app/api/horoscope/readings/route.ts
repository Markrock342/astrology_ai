import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { createReadingSchema } from "@/lib/schemas";
import { createReading } from "@/server/horoscope/reading-service";
import {
  appendExchangeToConversation,
  loadPriorMessages,
} from "@/server/horoscope/thread-service";
import { FEATURES } from "@/config/features";
import { AppError } from "@/lib/errors";

/**
 * Create a horoscope reading (spec 5.6). The `Idempotency-Key` header prevents
 * duplicate readings / double charges when the user retries or double-clicks.
 * Pass `conversationId` in the body to continue a multi-turn thread.
 */
export async function POST(req: Request) {
  return handle(async () => {
    if (!FEATURES.aiChat) {
      throw new AppError(
        "FEATURE_DISABLED",
        "ระบบดูดวงด้วย AI จะเปิดให้ใช้งานในเฟสถัดไป",
      );
    }
    const user = await requireUser();
    rateLimit(`reading:${user.id}`, 10, 60_000);

    const body = await req.json();
    const { categorySlug, question, conversationId } = createReadingSchema.parse(body);
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;

    const priorMessages = conversationId
      ? await loadPriorMessages(conversationId, user.id)
      : undefined;

    const reading = await createReading({
      userId: user.id,
      categorySlug,
      question,
      idempotencyKey,
      priorMessages,
    });

    if (conversationId && idempotencyKey) {
      await appendExchangeToConversation({
        conversationId,
        userId: user.id,
        userContent: question,
        idempotencyKey,
        assistantContent: reading.responseText ?? "",
        provider: reading.provider ?? undefined,
        modelId: reading.modelId,
        creditCost: reading.creditCost,
        status: reading.status,
      });
    }

    return ok(reading, { status: 201 });
  });
}
