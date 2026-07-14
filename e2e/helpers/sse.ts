import type { Page, Route } from "@playwright/test";

export const THREAD_ID = "e2e-thread-1";
export const USER_MSG_ID = "e2e-msg-user";
export const ASSISTANT_MSG_ID = "e2e-msg-assistant";

type SseEvent = Record<string, unknown>;

/** Encode events the way the route does: `data: <json>\n\n` per frame. */
export function sseBody(events: SseEvent[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

/**
 * The frame sequence a healthy turn produces. Mirrors
 * src/app/api/conversations/[id]/messages/route.ts — if that contract changes,
 * these specs must fail, which is the point.
 */
export function happyTurn(answer: string): SseEvent[] {
  return [
    {
      type: "accepted",
      messageIds: { user: USER_MSG_ID, assistant: ASSISTANT_MSG_ID },
    },
    { type: "status", phase: "chart" },
    { type: "status", phase: "memory" },
    { type: "status", phase: "writing" },
    // Chunked, so a broken consumer loop shows up as missing/garbled text.
    ...chunk(answer, 12).map((text) => ({ type: "delta", text })),
    {
      type: "done",
      elapsedMs: 4200,
      messageIds: { user: USER_MSG_ID, assistant: ASSISTANT_MSG_ID },
      reading: {
        id: "e2e-reading-1",
        responseText: answer,
        modelId: "gemini-3.5-flash",
        provider: "GEMINI",
        creditCost: 1,
        status: "SUCCESS",
        chartSnapshot: null,
        transitSnapshot: null,
      },
      followUps: [],
      creditCost: 1,
    },
    { type: "meta", summaryLine: "สรุปสั้น", followUps: ["ถามต่อ ก", "ถามต่อ ข"] },
  ];
}

function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function json(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data }),
  });
}

export type StubOptions = {
  /** Frames the message endpoint replies with. Defaults to a healthy turn. */
  events?: SseEvent[];
  /** Messages the thread/poll endpoints report as already persisted. */
  messages?: Array<Record<string, unknown>>;
  /** Called with the parsed request body every time a message is sent. */
  onSend?: (body: Record<string, unknown>) => void;
};

/**
 * Stub every chat endpoint so a spec exercises OUR client against a fixed
 * server contract — no Gemini, no credits, no flake.
 */
export async function stubChat(page: Page, opts: StubOptions = {}) {
  const answer = "นี่คือคำตอบทดสอบจากระบบ";
  const events = opts.events ?? happyTurn(answer);
  const messages = opts.messages ?? [];

  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() === "POST") {
      return json(route, { id: THREAD_ID });
    }
    return route.fallback();
  });

  await page.route("**/api/conversations/*/messages", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    opts.onSend?.(route.request().postDataJSON() ?? {});
    return route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
      body: sseBody(events),
    });
  });

  await page.route("**/api/conversations/*/poll", (route) =>
    json(route, { hasPending: false, messages }),
  );

  await page.route(`**/api/conversations/${THREAD_ID}`, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return json(route, {
      id: THREAD_ID,
      categorySlug: "self",
      categoryLabel: "ตัวตน",
      mode: "NATAL",
      transitDate: null,
      transitTime: null,
      messages,
    });
  });

  return { answer };
}
