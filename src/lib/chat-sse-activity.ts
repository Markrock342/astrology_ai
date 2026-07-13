/** Hard cap — align with poll timeout and route maxDuration headroom. */
export const STALE_TURN_MS = 120_000;

/** After first delta, stall if no further SSE activity for this long. */
export const STREAM_STALL_MS = 90_000;

/** Abort fetch when no SSE bytes arrive for this long (sliding window). */
export const SSE_STREAM_IDLE_MS = 120_000;

export type ChatPrepPhase = "chart" | "memory" | "writing";

const PREP_PHASE_LABELS: Record<ChatPrepPhase, string> = {
  chart: "กำลังคำนวณพื้นดวง…",
  memory: "กำลังวิเคราะห์เรือนและดาว…",
  writing: "กำลังเขียนคำทำนาย…",
};

export function isSseActivityEvent(type: string | undefined): boolean {
  return type === "delta" || type === "ping" || type === "status" || type === "done";
}

export function parsePrepPhase(
  phase: string | undefined,
): ChatPrepPhase | null {
  if (phase === "chart" || phase === "memory" || phase === "writing") {
    return phase;
  }
  return null;
}

export function prepPhaseLabel(phase: ChatPrepPhase | null): string {
  if (!phase) return "กำลังเพ่งดวงดาว…";
  return PREP_PHASE_LABELS[phase];
}

export function shouldRecoverStaleTurn(input: {
  startedAt: number;
  lastActivityAt: number | null;
  now: number;
  isStreaming: boolean;
  hasReceivedDelta: boolean;
}): boolean {
  const last = input.lastActivityAt ?? input.startedAt;
  const threshold =
    input.isStreaming && input.hasReceivedDelta
      ? STREAM_STALL_MS
      : STALE_TURN_MS;
  return input.now - last >= threshold;
}

type MergeableMessage = {
  id: string;
  role: string;
  content: string;
  status?: string;
  idempotencyKey?: string;
};

/** Keep longer local partial text when poll returns an empty/stale PENDING row. */
export function mergePollMessages<T extends MergeableMessage>(
  local: T[],
  remote: T[],
): T[] {
  const localById = new Map(local.map((m) => [m.id, m]));
  const localByKey = new Map(
    local
      .filter((m) => m.idempotencyKey)
      .map((m) => [m.idempotencyKey as string, m]),
  );

  return remote.map((remoteMsg) => {
    const localMsg =
      localById.get(remoteMsg.id) ??
      (remoteMsg.idempotencyKey
        ? localByKey.get(remoteMsg.idempotencyKey)
        : undefined);
    if (
      !localMsg ||
      remoteMsg.role !== "assistant" ||
      remoteMsg.status !== "PENDING"
    ) {
      return remoteMsg;
    }
    const localLen = localMsg.content?.length ?? 0;
    const remoteLen = remoteMsg.content?.length ?? 0;
    if (localLen > remoteLen) {
      return { ...remoteMsg, content: localMsg.content };
    }
    return remoteMsg;
  });
}
