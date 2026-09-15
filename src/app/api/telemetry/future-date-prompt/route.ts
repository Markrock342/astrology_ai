import { futureDatePromptEventBodySchema } from "@/lib/future-date-prompt-telemetry";
import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/rbac";
import { recordFutureDatePromptEvent } from "@/server/analytics/future-date-prompt-service";

const ROUTE = "/api/telemetry/future-date-prompt";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-vercel-id");
  console.log(
    JSON.stringify({
      level: "info",
      message: "future_date_prompt_event_start",
      route: ROUTE,
      requestId,
    }),
  );
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`future-date-prompt:${user.id}`, 60, 60_000);
    const event = futureDatePromptEventBodySchema.parse(await req.json());
    const result = await recordFutureDatePromptEvent(event);
    console.log(
      JSON.stringify({
        level: "info",
        message: "future_date_prompt_event_recorded",
        route: ROUTE,
        requestId,
        trigger: event.trigger,
        action: event.action,
        durationMs: Date.now() - startedAt,
      }),
    );
    return ok(result);
  });
}
