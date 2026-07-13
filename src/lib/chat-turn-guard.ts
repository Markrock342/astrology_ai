export type ChatTurnLock = {
  idempotencyKey: string;
  assistantId: string;
  threadId: string | null;
};

export type ChatTurnGuardInput = {
  state: "idle" | "processing" | "streaming" | "locked" | "no-quota" | "error";
  inFlight: boolean;
  activeTurn: ChatTurnLock | null;
  pendingAssistant: boolean;
  bypassBusyGuard: boolean;
};

/** Block a new send while a turn is in progress (unless retry/regenerate/edit). */
export function shouldBlockFollowUpSend(input: ChatTurnGuardInput): boolean {
  if (input.bypassBusyGuard) return false;
  if (input.activeTurn) return true;
  if (input.pendingAssistant) return true;
  return (
    input.inFlight &&
    (input.state === "processing" || input.state === "streaming")
  );
}

export function assistantIdForTurn(idempotencyKey: string): string {
  return `stream-${idempotencyKey}`;
}

export function resolveActiveAssistantId(
  inFlightKey: string | null | undefined,
  activeTurn: ChatTurnLock | null,
): string | null {
  if (inFlightKey) return assistantIdForTurn(inFlightKey);
  return activeTurn?.assistantId ?? null;
}
