import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { createReadingSchema } from "@/lib/schemas";
import { createReading } from "@/server/horoscope/reading-service";

/**
 * Create a horoscope reading (spec 5.6). The `Idempotency-Key` header prevents
 * duplicate readings / double charges when the user retries or double-clicks.
 * All permission, quota, AI and credit logic lives in the reading service.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    rateLimit(`reading:${user.id}`, 10, 60_000);

    const body = await req.json();
    const { categorySlug, question } = createReadingSchema.parse(body);
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;

    const reading = await createReading({
      userId: user.id,
      categorySlug,
      question,
      idempotencyKey,
    });

    return ok(reading, { status: 201 });
  });
}
