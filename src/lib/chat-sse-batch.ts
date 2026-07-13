/** Parsed SSE payload from a single `data:` line in the chat stream. */
export type ChatSseEvent = {
  type?: string;
  text?: string;
  code?: string;
  message?: string;
};

/** Fold delta events into assembled text — one pass per network chunk. */
export function foldChatSseDeltas(
  assembled: string,
  events: ChatSseEvent[],
): { assembled: string; hadDelta: boolean } {
  let next = assembled;
  let hadDelta = false;
  for (const event of events) {
    if (event.type === "delta" && event.text) {
      hadDelta = true;
      next += event.text;
    }
  }
  return { assembled: next, hadDelta };
}
