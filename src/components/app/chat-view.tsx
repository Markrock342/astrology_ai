"use client";

import { useCallback, useEffect, useRef, useState, forwardRef } from "react";
import { useSearchParams } from "next/navigation";
import { APP_NAME, DEFAULTS } from "@/config/constants";
import { FEATURES } from "@/config/features";
import { ChatThreadSkeleton } from "@/components/app/content-skeleton";
import {
  isCategoryLocked,
  useAppData,
  useCategory,
} from "./app-data-provider";

import { BrandMark } from "@/components/brand-logo";
import { ExpandableRasiWheel } from "./expandable-rasi-wheel";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { ChatUsageBar } from "./chat-usage-bar";
import { CopyMessageButton } from "./copy-message-button";
import { MessageActions } from "./message-actions";
import { NatalChartBanner } from "./natal-chart-banner";
import { SmoothStreamMarkdown } from "./smooth-stream-markdown";
import { useMyUsage } from "@/hooks/use-my-usage";
import type { ChartJson } from "@/types/chart";
import { softNavigate } from "./chat-nav";
import {
  getCachedThread,
  prefetchThread,
  setCachedThread,
  type CachedChatMessage,
} from "./thread-cache";

type ThinkingPhase = "chart" | "memory" | "writing";
type AnswerMode = "brief" | "detailed";
type FeedbackValue = "up" | "down";

const THINKING_PHASE_LABEL: Record<ThinkingPhase, string> = {
  chart: "กำลังคำนวณพื้นดวง…",
  memory: "กำลังวิเคราะห์เรือนและดาว…",
  writing: "กำลังเขียนคำทำนาย…",
};

const ANSWER_MODE_KEY = "horasard:answerMode";
const DRAFT_KEY = "horasard:chatDraft";
const FEEDBACK_KEY = "horasard:messageFeedback";

/** Wall-clock helper kept outside the component so React purity lint ignores it. */
function nowMs(): number {
  return Date.now();
}

function readAnswerMode(): AnswerMode {
  if (typeof window === "undefined") return "detailed";
  const saved = window.localStorage.getItem(ANSWER_MODE_KEY);
  return saved === "brief" ? "brief" : "detailed";
}

function readDraft(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DRAFT_KEY) ?? "";
}

function readFeedbackMap(): Record<string, FeedbackValue> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, FeedbackValue> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (value === "up" || value === "down") out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  status?: "SUCCESS" | "FAILED" | "TIMEOUT" | "PENDING";
  chartSnapshot?: ChartJson | null;
  transitSnapshot?: ChartJson | null;
  /** Present only while PENDING — the handle the stop endpoint needs. */
  idempotencyKey?: string;
  summaryLine?: string;
  followUps?: string[];
  /**
   * The real DB row id, learned from the `done` event. Optimistic bubbles keep
   * their local id as the React key (swapping keys would remount and re-animate
   * the whole turn), so server-addressed actions read this instead.
   */
  serverId?: string;
  /** Row creation time — for a PENDING turn, when it actually started. */
  createdAt?: string;
  /** This user's own thumbs verdict, as the SERVER knows it. */
  feedback?: FeedbackValue;
  /** How long the finished turn took, server-measured (from the done event). */
  elapsedMs?: number;
};

/**
 * The DB row id for a message, or undefined while it is still optimistic.
 * Edit/regenerate/retry must never send a `local-*`/`stream-*` id — the server
 * looks the row up by id and answers "ไม่พบข้อความผู้ใช้นี้".
 */
function serverIdOf(m: Message): string | undefined {
  if (m.serverId) return m.serverId;
  if (
    m.id.startsWith("local-") ||
    m.id.startsWith("stream-") ||
    // Legacy threads are synthesised from a HoroscopeReading, not Message rows:
    // nothing can be addressed by these ids, so every action on them 404s.
    m.id.startsWith("legacy-")
  ) {
    return undefined;
  }
  return m.id;
}
type ChatState =
  | "idle"
  | "processing"
  | "streaming"
  | "locked"
  | "no-quota"
  | "error";

/** Errors where retry reuses the same Idempotency-Key (no double charge). */
const RETRYABLE_ERRORS = new Set([
  "AI_TIMEOUT",
  "AI_PROVIDER_ERROR",
  "RATE_LIMITED",
  "NETWORK",
  "INTERNAL",
]);

/** Errors that should offer upgrade / account CTA (not retry). */
const UPGRADE_ERRORS = new Set([
  "CHAT_REQUIRES_PRO",
  "TRANSIT_REQUIRES_PRO",
  "FOLLOWUP_REQUIRES_PRO",
  "CATEGORY_LOCKED",
  "QUOTA_EXCEEDED",
]);

/** Map API error codes (lib/errors.ts) to friendly Thai messages. */
const ERROR_MESSAGES: Record<string, string> = {
  NO_QUOTA: "เครดิตหมดแล้ว เติมเครดิตหรืออัปเกรดเป็น Pro เพื่อถามต่อ",
  CATEGORY_LOCKED: "หมวดนี้สำหรับสมาชิก Pro",
  CHAT_REQUIRES_PRO: "ต้องอัปเกรดเป็น Pro ก่อนจึงจะสนทนากับ AI ได้",
  CHAT_REQUIRES_PRO_PENDING:
    "สลิปของคุณอยู่ระหว่างตรวจสอบ ปกติภายใน 1–2 วันทำการ — หลังอนุมัติจะแชทได้ทันที",
  TRANSIT_REQUIRES_PRO: "โหมดดวงจรสำหรับสมาชิก Pro เท่านั้น อัปเกรดเพื่อใช้งาน",
  FOLLOWUP_REQUIRES_PRO:
    "ถามต่อในบทสนทนาเดิมสำหรับสมาชิก Pro — เริ่มคำถามใหม่ได้ตราบใดที่ยังมีเครดิต",
  EMAIL_NOT_VERIFIED:
    "ยืนยันอีเมลก่อนใช้เครดิตทดลองฟรี — เช็กกล่องจดหมายของคุณได้เลย",
  CHART_NOT_READY:
    "ยังคำนวณพื้นดวงไม่สำเร็จ กรุณาตรวจสอบข้อมูลวันเกิดแล้วลองใหม่",
  AI_TIMEOUT: "หมอดูใช้เวลานานเกินไป ลองถามใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
  AI_PROVIDER_ERROR: "ระบบทำนายขัดข้องชั่วคราว ลองใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
  VALIDATION: "กรุณากรอกข้อมูลวันเกิดก่อนเริ่มดูดวง",
  RATE_LIMITED: "ถามถี่เกินไป รอสักครู่แล้วลองใหม่",
  QUOTA_EXCEEDED:
    "โควต้าวันนี้หรือเดือนนี้ครบแล้ว รอรีเซ็ตหรือไปหน้าบัญชีเพื่อเติมเครดิต",
  UNAUTHENTICATED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  USER_DISABLED: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อแอดมิน",
  FEATURE_DISABLED: "ระบบดูดวงด้วย AI กำลังอยู่ระหว่างพัฒนา",
};

function modelLabel(modelId: string): string {
  return modelId
    .split("-")
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const EMPTY_HEADING =
  "ในทางโหราศาสตร์ไทย ดวงดาวเป็นเพียงเครื่องมือ\nบอกจังหวะชีวิตเพื่อให้เราเตรียมพร้อม";
const EMPTY_PARAGRAPH =
  "การทำนายไม่ใช่การกำหนดชะตา แต่เป็นแนวทางให้เรารู้จังหวะ เพื่อวางแผนและลงมือทำอย่างมีสติ สิ่งที่สำคัญที่สุดคือการกระทำและจิตใจของเราเอง ไม่ว่าดวงจะบอกอะไร เราก็ยังเป็นผู้เลือกทางเดินของตัวเองได้เสมอ";

type PendingRetry = {
  question: string;
  idempotencyKey: string;
};

type SendOpts = {
  retryKey?: string;
  editUserMessageId?: string;
  regenerateAssistantMessageId?: string;
};

const SCROLL_NEAR_BOTTOM_PX = 120;
/** No stream delta for this long → treat the turn as stuck and recover. */
const STALE_TURN_MS = 45_000;
/** Abort the HTTP stream if no SSE arrives — fall back to background poll. */
const FETCH_STREAM_TIMEOUT_MS = 35_000;

/** The handle needed to cancel an answer that is still generating. */
type StopTarget = { threadId: string; idempotencyKey: string };

async function parseApiJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function localizeApiError(message: string | undefined, fallback: string): string {
  if (!message?.trim()) return fallback;
  const trimmed = message.trim();
  if (
    trimmed === "Something went wrong" ||
    trimmed.includes("connection pool") ||
    trimmed.includes("Timed out fetching a new connection")
  ) {
    return "ระบบฐานข้อมูลไม่ว่างชั่วคราว กรุณารอสักครู่แล้วลองใหม่";
  }
  return trimmed;
}

function applyApiError(
  code: string,
  message: string | undefined,
  setters: {
    setErrorCode: (code: string | null) => void;
    setErrorText: (text: string | null) => void;
    setState: (state: ChatState) => void;
    setPendingRetry: (retry: PendingRetry | null) => void;
  },
  retry: PendingRetry | null,
  opts?: { hasPendingPayment?: boolean },
) {
  setters.setErrorCode(code);
  if (code === "CATEGORY_LOCKED") {
    setters.setState("locked");
    setters.setPendingRetry(null);
    return;
  }
  const pendingChatMsg =
    code === "CHAT_REQUIRES_PRO" && opts?.hasPendingPayment
      ? ERROR_MESSAGES.CHAT_REQUIRES_PRO_PENDING
      : null;
  // For a KNOWN code, the curated Thai message wins — the raw server string
  // (often English, e.g. "AI request failed") was shadowing it. Fall back to the
  // localized server message only for codes we have no copy for.
  const curated = ERROR_MESSAGES[code];
  setters.setErrorText(
    pendingChatMsg ??
      curated ??
      localizeApiError(message, "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"),
  );
  setters.setState(
    code === "NO_QUOTA" || code === "QUOTA_EXCEEDED" ? "no-quota" : "error",
  );
  if (!RETRYABLE_ERRORS.has(code)) {
    setters.setPendingRetry(null);
  } else if (retry) {
    setters.setPendingRetry(retry);
  }
}

export function ChatView() {
  const searchParams = useSearchParams();
  const catSlug = searchParams.get("cat");
  const threadId = searchParams.get("thread");
  const { user, refreshLight, pendingPayment } = useAppData();
  const category = useCategory(catSlug);
  const locked = isCategoryLocked(category, user?.plan ?? "FREE");
  const hasPendingPayment = Boolean(pendingPayment);
  const {
    usage,
    loading: usageLoading,
    apiReady: usageApiReady,
    refresh: refreshUsage,
  } = useMyUsage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("detailed");
  const [feedbackById, setFeedbackById] = useState<
    Record<string, FeedbackValue>
  >({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  /**
   * Screen-reader announcement. The typewriter updates the DOM ~60×/sec, so an
   * aria-live region on the answer itself would machine-gun a screen reader with
   * fragments. Instead we announce the COMPLETE answer once, when the turn
   * settles — and nothing on thread load, so history is not read aloud.
   */
  const [liveAnnounce, setLiveAnnounce] = useState("");
  /** Newest tap per message wins — see setMessageFeedback. */
  const feedbackSeqRef = useRef<Map<string, number>>(new Map());
  const [state, setState] = useState<ChatState>("idle");
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase | null>(
    null,
  );
  /**
   * Epoch ms this turn started, for the elapsed counter. Kept in state (not on
   * processingStartedAtRef) because the indicator reads it during render, and a
   * ref read there is neither reactive nor pure.
   */
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const draftHydratedRef = useRef(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);
  const [threadCategorySlug, setThreadCategorySlug] = useState<string | null>(
    null,
  );
  const [threadMode, setThreadMode] = useState<"NATAL" | "TRANSIT" | null>(
    null,
  );
  const [threadTransitLabel, setThreadTransitLabel] = useState<string | null>(
    null,
  );
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const streamTimer = useRef<number | null>(null);
  const conversationIdRef = useRef<string | null>(threadId);
  const streamAbortRef = useRef<AbortController | null>(null);
  const assembledRef = useRef("");
  // Stopping is an explicit server call, not just an aborted fetch: dropping the
  // connection has to let the answer finish in the background (so a refresh
  // never strands it as "generating"), while stop must actually cancel the model.
  const [inFlight, setInFlight] = useState<StopTarget | null>(null);
  const [stopping, setStopping] = useState(false);
  // A send owns the message list for its thread. Creating a thread rewrites the
  // URL, which wakes the loader below — and the just-created thread comes back
  // empty, because the turn is still being persisted. Without this guard that
  // empty response overwrites the optimistic bubbles and the answer streams into
  // a message that no longer exists, leaving a blank chat.
  const sendingThreadRef = useRef<string | null>(null);
  /** Which thread the on-screen `messages` array actually belongs to. */
  const messagesThreadRef = useRef<string | null>(threadId);
  const processingStartedAtRef = useRef<number | null>(null);
  const lastDeltaAtRef = useRef<number | null>(null);
  const explicitStopRef = useRef(false);

  async function stopStreaming(target: StopTarget | null) {
    if (!target || stopping) return;
    setStopping(true);
    explicitStopRef.current = true;
    // Instant UI: cut the local stream and keep whatever already arrived.
    streamAbortRef.current?.abort();
    const partial = assembledRef.current.trim();
    const assistantId = `stream-${target.idempotencyKey}`;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId || m.idempotencyKey === target.idempotencyKey
          ? {
              ...m,
              content:
                partial ||
                m.content ||
                "หยุดการทำนายแล้ว",
              status: "SUCCESS",
              idempotencyKey: target.idempotencyKey,
            }
          : m,
      ),
    );
    setState("idle");
    setInFlight(null);
    try {
      await fetch(`/api/conversations/${target.threadId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: target.idempotencyKey }),
        // The UI already settled optimistically, so this call is best-effort —
        // but without a deadline a hung request left `stopping` true forever,
        // and the Stop button never came back for the rest of the session.
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      /* server stop is best-effort — UI already settled */
    } finally {
      setStopping(false);
    }
  }
  const usageRefreshRef = useRef(refreshUsage);
  useEffect(() => {
    usageRefreshRef.current = refreshUsage;
  }, [refreshUsage]);

  useEffect(() => {
    conversationIdRef.current = threadId;
  }, [threadId]);

  // Hydrate answer mode, draft, and thumbs from localStorage once on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydrate
    setAnswerMode(readAnswerMode());
    setFeedbackById(readFeedbackMap());
    if (!draftHydratedRef.current) {
      draftHydratedRef.current = true;
      const draft = readDraft();
      if (draft) setInput(draft);
    }
  }, []);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    if (editingMessageId) return;
    if (input.trim()) {
      window.localStorage.setItem(DRAFT_KEY, input);
    } else {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [input, editingMessageId]);

  function updateAnswerMode(mode: AnswerMode) {
    setAnswerMode(mode);
    window.localStorage.setItem(ANSWER_MODE_KEY, mode);
  }

  /**
   * Record a thumbs verdict — and actually TELL the server about it.
   *
   * This used to write to localStorage and stop there, so a user could tell us an
   * answer was wrong and we would never find out: the only direct read we have on
   * answer quality died in their browser. localStorage is now just the optimistic
   * cache; the database is the record.
   *
   * Tapping the same thumb again withdraws the verdict, which is what people
   * expect and also the only way to undo a misclick.
   */
  /**
   * Adopt the server's verdicts for a freshly loaded thread.
   *
   * localStorage was the only store, so a thumb pressed on a phone was invisible
   * on a laptop and clearing site data silently un-voted everything. It is a
   * cache now; the database is the record, and the record wins.
   */
  function hydrateFeedback(loaded: Message[]) {
    // Authoritative for the messages in this thread: adopt the server's verdict
    // AND drop any local verdict the server no longer has (withdrawn on another
    // device). Verdicts for messages NOT in this payload are left untouched.
    setFeedbackById((prev) => {
      const map = { ...prev };
      let changed = false;
      for (const m of loaded) {
        const sid = serverIdOf(m);
        if (!sid) continue;
        if (m.feedback) {
          if (map[sid] !== m.feedback) {
            map[sid] = m.feedback;
            changed = true;
          }
        } else if (sid in map) {
          delete map[sid];
          changed = true;
        }
      }
      if (!changed) return prev;
      window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map));
      return map;
    });
  }

  function setMessageFeedback(messageId: string, value: FeedbackValue) {
    const previous = feedbackById[messageId] ?? null;
    const next = previous === value ? null : value;

    // Tap twice quickly and two requests are in flight at once. Whichever
    // RESOLVES last used to win, so a late rollback from the first tap could
    // re-apply a verdict the second tap had just withdrawn — leaving the UI
    // showing a vote the database does not have. Only the newest tap per message
    // is allowed to touch the state.
    const seq = (feedbackSeqRef.current.get(messageId) ?? 0) + 1;
    feedbackSeqRef.current.set(messageId, seq);
    const isStale = () => feedbackSeqRef.current.get(messageId) !== seq;

    setFeedbackById((prev) => {
      const map = { ...prev };
      if (next) map[messageId] = next;
      else delete map[messageId];
      window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map));
      return map;
    });
    setFeedbackError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/messages/${messageId}/feedback`, {
          method: next ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          ...(next
            ? { body: JSON.stringify({ value: next === "up" ? "UP" : "DOWN" }) }
            : {}),
        });
        if (res.ok) return;
        throw new Error(String(res.status));
      } catch {
        if (isStale()) return;
        // The server did not take it, so the UI must not claim it did — and it
        // must SAY so. A thumb that lights up and silently pops back off is
        // indistinguishable from a dead button, and the user just concludes the
        // feature is broken and stops telling us anything.
        setFeedbackById((prev) => {
          const map = { ...prev };
          if (previous) map[messageId] = previous;
          else delete map[messageId];
          window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map));
          return map;
        });
        setFeedbackError("บันทึกฟีดแบ็กไม่สำเร็จ — ลองใหม่อีกครั้ง");
      }
    })();
  }

  // Load past thread when ?thread= is set — soft switch from cache first.
  useEffect(() => {
    if (!threadId) return;
    // Stand down only while this thread's OWN bubbles are the ones on screen.
    // Keying the guard on the send alone meant that leaving a streaming thread
    // and coming back never reloaded it — the list still held the other
    // conversation's messages, so you saw the wrong chat under this URL.
    if (
      sendingThreadRef.current === threadId &&
      messagesThreadRef.current === threadId
    ) {
      return;
    }
    let alive = true;
    messagesThreadRef.current = threadId;

    const cached = getCachedThread(threadId);
    if (cached?.messages?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(cached.messages as Message[]);
      setThreadCategorySlug(cached.categorySlug ?? null);
      setThreadMode(cached.mode === "TRANSIT" ? "TRANSIT" : "NATAL");
      setLoadingThread(false);
      setThreadLoadError(null);
      const pending = cached.messages.some(
        (m) => m.role === "assistant" && m.status === "PENDING",
      );
      setState(pending ? "processing" : "idle");
    } else {
      setLoadingThread(true);
      setThreadLoadError(null);
    }

    void prefetchThread(threadId).then((payload) => {
      if (!alive || !payload) {
        if (!alive) return;
        if (!cached) {
          setThreadLoadError(
            "โหลดประวัติการสนทนาไม่สำเร็จหรือใช้เวลานานเกินไป — กดลองใหม่หรือเริ่มสนทนาใหม่",
          );
          setMessages([]);
          setState("error");
          setLoadingThread(false);
        }
        return;
      }
      const loaded = payload.messages as Message[];
      setMessages(loaded);
      // The database is the record; localStorage was only ever a cache. Adopt
      // the server's verdicts so a thumb pressed on a phone shows on a laptop,
      // and clearing site data no longer silently un-votes everything.
      hydrateFeedback(loaded);
      setThreadCategorySlug(payload.categorySlug ?? null);
      setThreadMode(payload.mode === "TRANSIT" ? "TRANSIT" : "NATAL");
      if (payload.mode === "TRANSIT" && payload.transitDate) {
        const d = new Date(payload.transitDate);
        const dateLabel = Number.isNaN(d.getTime())
          ? null
          : d.toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            });
        const time = payload.transitTime ? ` · ${payload.transitTime}` : "";
        setThreadTransitLabel(dateLabel ? `${dateLabel}${time}` : null);
      } else {
        setThreadTransitLabel(null);
      }
      const msgs = payload.messages as Message[];
      const pending = msgs.some(
        (m) => m.role === "assistant" && m.status === "PENDING",
      );
      const failed = [...msgs]
        .reverse()
        .find((m) => m.role === "assistant" && m.status === "FAILED");
      if (pending) {
        setState("processing");
        setErrorText(null);
        setErrorCode(null);
      } else if (failed) {
        setState("error");
        setErrorText(failed.content || ERROR_MESSAGES.AI_PROVIDER_ERROR);
        setErrorCode("AI_PROVIDER_ERROR");
      } else {
        setState("idle");
        setErrorText(null);
        setErrorCode(null);
        setPendingRetry(null);
      }
      setLoadingThread(false);
    });

    return () => {
      alive = false;
    };
  }, [threadId]);

  // Keep cache warm while chatting.
  useEffect(() => {
    if (!threadId || messages.length === 0) return;
    setCachedThread(threadId, {
      messages: messages as CachedChatMessage[],
      categorySlug: threadCategorySlug,
      mode: threadMode,
    });
  }, [threadId, messages, threadCategorySlug, threadMode]);

  // Mirror for async callbacks (poll) that must compare against the current
  // list without re-subscribing on every message change.
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Poll while a background reply is still PENDING (leave/return safe).
  const pendingAssistant = messages.find(
    (m) => m.role === "assistant" && m.status === "PENDING",
  );
  const pendingAssistantIds = messages
    .filter((m) => m.role === "assistant" && m.status === "PENDING")
    .map((m) => m.id)
    .join(",");

  // A reload loses `inFlight`, but the PENDING row carries its own key — so the
  // stop button keeps working on a thread the user came back to.
  const stopTarget: StopTarget | null =
    inFlight ??
    (threadId && pendingAssistant?.idempotencyKey
      ? { threadId, idempotencyKey: pendingAssistant.idempotencyKey }
      : null);

  const recoverStaleTurn = useCallback(
    (reason: string) => {
      processingStartedAtRef.current = null;
      lastDeltaAtRef.current = null;
      setInFlight(null);
      setThinkingPhase(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.role === "assistant" && m.status === "PENDING" && !m.content.trim()
            ? {
                ...m,
                status: "FAILED" as const,
                content: reason,
              }
            : m,
        ),
      );
      setState("error");
      setErrorCode("AI_TIMEOUT");
      setErrorText(reason);
    },
    [],
  );

  // If a turn stalls with no text, unblock the composer and offer retry.
  useEffect(() => {
    if (state !== "processing" && state !== "streaming") {
      processingStartedAtRef.current = null;
      lastDeltaAtRef.current = null;
      return;
    }
    if (!processingStartedAtRef.current) {
      processingStartedAtRef.current = Date.now();
    }
    const id = window.setInterval(() => {
      const started = processingStartedAtRef.current;
      if (!started) return;
      const lastActivity = lastDeltaAtRef.current ?? started;
      if (Date.now() - lastActivity < STALE_TURN_MS) return;
      recoverStaleTurn(
        "ใช้เวลานานผิดปกติ — กดลองใหม่ (ยังไม่หักเครดิตถ้ายังไม่มีคำตอบ)",
      );
    }, 3000);
    return () => window.clearInterval(id);
  }, [state, recoverStaleTurn]);

  useEffect(() => {
    if (!threadId || !pendingAssistantIds) return;
    // While this tab owns a live SSE turn, the stream is the source of truth.
    // Polling alongside it raced the accept: the server had no PENDING row yet,
    // so /poll returned the OLD message list and setMessages() wiped the user's
    // optimistic bubble and the streaming placeholder mid-answer.
    if (inFlight) return;

    let alive = true;
    const timer: { id: number | undefined } = { id: undefined };
    const pollStarted = Date.now();
    const timedOut = () => Date.now() - pollStarted > 120_000;
    const giveUp = () => {
      alive = false;
      if (timer.id !== undefined) window.clearInterval(timer.id);
      setState("error");
      setErrorCode("AI_TIMEOUT");
      setErrorText(
        "ใช้เวลานานเกินไป — ลองถามใหม่อีกครั้ง (ยังไม่หักเครดิตถ้ายังไม่มีคำตอบ)",
      );
    };
    const tick = async () => {
      try {
        const res = await fetch(`/api/conversations/${threadId}/poll`);
        const json = await parseApiJson(res);
        if (!alive || !res.ok || !json?.ok) {
          // Only give up on the deadline if we could not even reach the server.
          // A reachable server that has finished is handled below — the old code
          // checked the clock FIRST and returned, so an answer that landed after
          // 120s stayed a false timeout (already charged) until a manual reload.
          if (timedOut() && alive) giveUp();
          return;
        }
        const poll = json.data as {
          hasPending: boolean;
          messages: Message[] | null;
        };

        if (poll.hasPending) {
          // Still generating after the deadline — genuinely stuck. Now it is a
          // real timeout, and we stop polling.
          if (timedOut()) {
            giveUp();
            return;
          }
          setState("processing");
          // A successful poll IS the heartbeat in poll-only mode (reload / return
          // to a live turn). The stale-turn watchdog is fed only by SSE frames,
          // so without this it force-failed a perfectly healthy reading at 45s.
          lastDeltaAtRef.current = nowMs();
          return;
        }

        // No PENDING on the server, but we are still waiting on a turn. If the
        // server list does not show that turn settled (a new assistant row, or
        // our PENDING row flipped to a final status), the accept simply hasn't
        // persisted yet — keep the optimistic bubbles and poll again instead of
        // replacing the list with a stale snapshot.
        const server = poll.messages ?? [];
        const prev = messagesRef.current;
        const localPending = prev.some(
          (m) => m.role === "assistant" && m.status === "PENDING",
        );
        const serverSettledOurTurn = server.some(
          (s) =>
            s.role === "assistant" &&
            (!prev.some((p) => p.id === s.id) ||
              prev.some(
                (p) =>
                  p.id === s.id &&
                  p.status === "PENDING" &&
                  s.status !== "PENDING",
              )),
        );
        if (localPending && !serverSettledOurTurn) return;

        if (poll.messages) {
          setMessages(poll.messages);
        }

        const lastFailed = [...(poll.messages ?? [])]
          .reverse()
          .find((m) => m.role === "assistant" && m.status === "FAILED");
        if (lastFailed) {
          setState("error");
          setErrorText(lastFailed.content || ERROR_MESSAGES.AI_PROVIDER_ERROR);
          setErrorCode("AI_PROVIDER_ERROR");
          return;
        }

        setState("idle");
        setErrorText(null);
        setErrorCode(null);
        setPendingRetry(null);
        void refreshLight();
        usageRefreshRef.current?.();
      } catch {
        /* keep polling */
      }
    };

    timer.id = window.setInterval(() => {
      void tick();
    }, 2000);
    const id = timer.id;
    void tick();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [threadId, pendingAssistantIds, inFlight, refreshLight]);

  // Reset the thread when the selected category changes (new chat).
  useEffect(() => {
    if (threadId) return;
    if (streamTimer.current) window.clearInterval(streamTimer.current);
    conversationIdRef.current = null;
    messagesThreadRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setThreadCategorySlug(null);
    setThreadMode(null);
    setThreadTransitLabel(null);
    setState(locked ? "locked" : "idle");
    setInput("");
    setErrorText(null);
    setErrorCode(null);
    setPendingRetry(null);
    setThreadLoadError(null);
  }, [catSlug, locked, threadId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowScrollFab(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_NEAR_BOTTOM_PX;
    isNearBottomRef.current = nearBottom;
    setShowScrollFab(!nearBottom);
  }, []);

  useEffect(() => {
    if (loadingThread) return;
    composerRef.current?.focus();
  }, [threadId, catSlug, loadingThread]);

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    scrollToBottom(
      state === "streaming" || state === "processing" ? "auto" : "smooth",
    );
  }, [messages, state, scrollToBottom]);

  // Follow content that grows WITHOUT a messages change: the typewriter revealing
  // its tail after `done`, a chart/table/image finishing layout. The effect
  // above fires on message updates; this keeps the newest line in view between
  // them — but only while the reader is already at the bottom, so it never yanks
  // the view away from someone scrolling back through the answer.
  const pinObserver = useRef<ResizeObserver | null>(null);
  function pinToBottomRef(el: HTMLDivElement | null) {
    pinObserver.current?.disconnect();
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!isNearBottomRef.current) return;
      const s = scrollRef.current;
      if (s) s.scrollTop = s.scrollHeight;
    });
    ro.observe(el);
    pinObserver.current = ro;
  }

  useEffect(() => {
    const timer = streamTimer;
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  async function ensureConversation(
    categorySlug: string,
    content: string,
    idempotencyKey: string,
  ): Promise<string | null> {
    const existing = threadId ?? conversationIdRef.current;
    if (existing) return existing;

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, mode: "NATAL" }),
    });
    const json = await parseApiJson(res);
    if (!res.ok || !json?.ok) {
      const code: string = json?.error?.code ?? "INTERNAL";
      applyApiError(
        code,
        json?.error?.message,
        { setErrorCode, setErrorText, setState, setPendingRetry },
        { question: content, idempotencyKey },
        { hasPendingPayment },
      );
      return null;
    }

    const id = json.data.id as string;
    conversationIdRef.current = id;
    return id;
  }

  async function send(text: string, opts?: SendOpts | string) {
    const options: SendOpts =
      typeof opts === "string" ? { retryKey: opts } : (opts ?? {});
    const content = text.trim();
    if (!content) return;

    const hasLiveTurn = Boolean(inFlight) || Boolean(stopTarget);
    if (hasLiveTurn && (state === "processing" || state === "streaming")) {
      return;
    }
    // Stale processing/streaming with no live server handle — recover locally.
    if ((state === "processing" || state === "streaming") && !hasLiveTurn) {
      setState("idle");
      setMessages((prev) =>
        prev.filter(
          (m) =>
            !(
              m.role === "assistant" &&
              m.status === "PENDING" &&
              !m.content.trim()
            ),
        ),
      );
    }

    // The edit target is addressed locally (React key) but must be sent to the
    // server by its DB row id.
    const editLocalId = options.editUserMessageId ?? editingMessageId ?? undefined;
    let editServerMessageId: string | undefined;
    if (editLocalId) {
      const idx = messages.findIndex((m) => m.id === editLocalId);
      const target = idx >= 0 ? messages[idx] : undefined;
      editServerMessageId = target ? serverIdOf(target) : undefined;
      if (!editServerMessageId) {
        // Not persisted yet — editing it would address a row that isn't there.
        setEditingMessageId(null);
        setErrorCode("VALIDATION");
        setErrorText("ข้อความนี้ยังบันทึกไม่เสร็จ รอสักครู่แล้วลองแก้ไขใหม่");
        setState("error");
        return;
      }
      if (idx >= 0) {
        setMessages((prev) => [
          ...prev.slice(0, idx),
          { ...prev[idx], content },
        ]);
      }
      setEditingMessageId(null);
      // The edit IS the send. Leaving the text in the composer made it look
      // unsent, so users pressed Enter again — a duplicate question and a
      // second credit charged.
      setInput("");
      window.localStorage.removeItem(DRAFT_KEY);
    }

    isNearBottomRef.current = true;
    scrollToBottom("auto");

    if (!FEATURES.aiChat) {
      setErrorCode("FEATURE_DISABLED");
      setErrorText(ERROR_MESSAGES.FEATURE_DISABLED);
      setState("error");
      setPendingRetry(null);
      return;
    }
    if (locked) {
      setState("locked");
      setErrorCode("CATEGORY_LOCKED");
      setPendingRetry(null);
      return;
    }
    const categorySlug = catSlug ?? threadCategorySlug;
    if (!categorySlug && !threadId && !conversationIdRef.current) {
      setErrorCode("VALIDATION");
      setErrorText("เลือกหมวดจากแถบข้างก่อนเริ่มดูดวง");
      setState("error");
      setPendingRetry(null);
      return;
    }

    const isRetry = Boolean(options.retryKey);
    const isRegenerate = Boolean(options.regenerateAssistantMessageId);
    // Local id: the server row does not exist yet. `done` brings back the real
    // one and we bind it as serverId (see serverIdOf).
    let optimisticUserId: string | null = null;
    if (!isRetry && !isRegenerate && !editLocalId) {
      optimisticUserId = `local-${crypto.randomUUID()}`;
      const userMsg: Message = { id: optimisticUserId, role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      window.localStorage.removeItem(DRAFT_KEY);
    }

    setErrorText(null);
    setErrorCode(null);
    setThinkingPhase(null);
    setState("processing");
    // Event-handler timing (not render) — stamp wall-clock for stale-turn recovery.
    processingStartedAtRef.current = nowMs();
    setTurnStartedAt(nowMs());
    lastDeltaAtRef.current = null;

    const idempotencyKey = options.retryKey ?? crypto.randomUUID();
    if (!isRetry) {
      setPendingRetry({ question: content, idempotencyKey });
    }

    const assistantId = `stream-${idempotencyKey}`;
    // Stream text accumulates on the ref so the catch/stop paths can keep a
    // partial answer without a mutable local the React Compiler flags.
    let activeConversationId: string | null = null;
    // Set once the turn settles (done/error/stream-end) — a coalesced flush
    // that fires after that must not repaint stale streaming state.
    let turnSettled = false;
    // The user can switch threads or start a new chat mid-answer. This stream
    // belongs to the thread it started on; painting its deltas — or its errors
    // and spinners — into whatever happens to be on screen would graft one
    // conversation onto another. Declared out here so the catch/finally paths
    // can gate on it too, not just the read loop.
    const ownsView = () =>
      activeConversationId !== null &&
      conversationIdRef.current === activeConversationId;
    assembledRef.current = "";
    explicitStopRef.current = false;
    const abort = new AbortController();
    streamAbortRef.current?.abort();
    streamAbortRef.current = abort;
    const fetchTimeout = window.setTimeout(() => {
      abort.abort();
    }, FETCH_STREAM_TIMEOUT_MS);

    // Show the assistant placeholder immediately — don't wait on ensureConversation.
    setMessages((prev) => {
      if (prev.some((m) => m.id === assistantId)) return prev;
      return [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          status: "PENDING",
          idempotencyKey,
        },
      ];
    });

    try {
      activeConversationId = categorySlug
        ? await ensureConversation(categorySlug, content, idempotencyKey)
        : (threadId ?? conversationIdRef.current);
      if (!activeConversationId) {
        // ensureConversation already surfaced the failure via applyApiError
        // (session expired, rate limit, disabled category, DB blip). Forcing
        // "idle" here clobbered that error state back off, so the user was left
        // staring at their own question with no reply, no message and no retry.
        // Keep the error; drop only the empty assistant placeholder so the
        // banner + retry render beneath the question.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        processingStartedAtRef.current = null;
        return;
      }

      // Claim it before the URL changes, so the loader never races this send.
      sendingThreadRef.current = activeConversationId;
      messagesThreadRef.current = activeConversationId;

      const syncCat = categorySlug ?? catSlug;
      if (!threadId && syncCat) {
        // The loader stands down for this thread, so seed what it would have set.
        setThreadCategorySlug(syncCat);
        setThreadMode("NATAL");
        setThreadLoadError(null);
        setLoadingThread(false);
        // Native history over router.replace: this only needs the URL to carry
        // the new thread id. router.replace would run a real navigation — a
        // fresh RSC request that re-renders the route mid-answer, which is the
        // "the page refreshed while it was typing" flash. softNavigate passes a
        // plain history state so Next actually syncs useSearchParams (passing
        // window.history.state here used to skip the sync entirely).
        softNavigate(
          `/dashboard?thread=${activeConversationId}&cat=${syncCat}`,
          { replace: true },
        );
        conversationIdRef.current = activeConversationId;
      }

      // Placeholder already added above — ensure idempotency key is wired for stop.
      // Re-arming a RETRY reuses the failed bubble, so wipe what the last attempt
      // left in it. Without this the old error text ("ระบบทำนายขัดข้อง…") sat in
      // the answer with a blinking caret, as if the model were writing it.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: "",
                status: "PENDING" as const,
                idempotencyKey,
                summaryLine: undefined,
                followUps: undefined,
                elapsedMs: undefined,
              }
            : m,
        ),
      );

      setInFlight({ threadId: activeConversationId, idempotencyKey });

      const res = await fetch(
        `/api/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            content,
            editUserMessageId: editServerMessageId,
            regenerateAssistantMessageId: options.regenerateAssistantMessageId,
            answerMode,
          }),
          signal: abort.signal,
        },
      );

      // Response headers arrived — the "no SSE at all" watchdog has done its
      // job. It must NOT keep running: it used to fire mid-stream and cut
      // every answer longer than 35s, freezing the text partway through.
      window.clearTimeout(fetchTimeout);

      // Non-SSE error JSON
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const json = await parseApiJson(res);
        if (!res.ok || !json?.ok) {
          const code: string = json?.error?.code ?? "INTERNAL";
          applyApiError(
            code,
            json?.error?.message,
            { setErrorCode, setErrorText, setState, setPendingRetry },
            { question: content, idempotencyKey },
            { hasPendingPayment },
          );
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        // Legacy 202 pending — fall back to poll
        if (
          res.status === 202 ||
          (json.data as { status?: string } | undefined)?.status === "pending"
        ) {
          setState("processing");
          void refreshLight();
          return;
        }
        const reading = json.data as {
          responseText: string;
          modelId: string | null;
          chartSnapshot?: ChartJson | null;
          transitSnapshot?: ChartJson | null;
        };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: reading.responseText,
                  modelId: reading.modelId ?? undefined,
                  status: "SUCCESS",
                  chartSnapshot: reading.chartSnapshot ?? null,
                  transitSnapshot: reading.transitSnapshot ?? null,
                }
              : m,
          ),
        );
        setState("idle");
        setPendingRetry(null);
        void refreshLight();
        usageRefreshRef.current?.();
        return;
      }

      if (!res.ok || !res.body) {
        setErrorCode("NETWORK");
        setErrorText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
        setState("error");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      // Coalesce deltas: the read loop never blocks on paint. Accumulated text
      // flushes to React at most once per frame; a hidden tab uses a timer
      // because rAF doesn't fire there (awaiting rAF per chunk used to stall
      // the whole stream in a background tab until the turn was declared stuck).
      let flushScheduled = false;
      const flushAssembled = () => {
        flushScheduled = false;
        if (turnSettled || !ownsView()) return;
        const assembled = assembledRef.current;
        setThinkingPhase(null);
        setState("streaming");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: assembled,
                  status: "PENDING" as const,
                  idempotencyKey,
                }
              : m,
          ),
        );
      };
      const scheduleFlush = () => {
        if (flushScheduled) return;
        flushScheduled = true;
        if (document.hidden) {
          window.setTimeout(flushAssembled, 80);
        } else {
          window.requestAnimationFrame(flushAssembled);
        }
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotDelta = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const block of parts) {
          const line = block
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let event: {
            type?: string;
            text?: string;
            phase?: string;
            code?: string;
            message?: string;
            summaryLine?: string;
            followUps?: string[];
            messageIds?: {
              user?: string | null;
              assistant?: string | null;
            };
            elapsedMs?: number;
            reading?: {
              responseText?: string | null;
              modelId?: string | null;
              chartSnapshot?: ChartJson | null;
              transitSnapshot?: ChartJson | null;
            };
          };
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          // Any frame (ping/status/delta) proves the connection is alive —
          // feed the stale-turn watchdog so it only fires on genuine silence,
          // not on a model that is still preparing a long answer.
          lastDeltaAtRef.current = nowMs();

          if (event.type === "accepted") {
            // Real row ids, before a single token is generated — so a turn that
            // gets stopped or fails still keeps its actions.
            if (!ownsView()) continue;
            const uid = event.messageIds?.user ?? undefined;
            const aid = event.messageIds?.assistant ?? undefined;
            if (!uid && !aid) continue;
            setMessages((prev) =>
              prev.map((m) => {
                if (aid && m.id === assistantId) {
                  return { ...m, serverId: aid };
                }
                if (uid && optimisticUserId && m.id === optimisticUserId) {
                  return { ...m, serverId: uid };
                }
                return m;
              }),
            );
          } else if (event.type === "status" && event.phase) {
            if (!ownsView()) continue;
            if (
              event.phase === "chart" ||
              event.phase === "memory" ||
              event.phase === "writing"
            ) {
              setThinkingPhase(event.phase);
            }
          } else if (event.type === "delta" && event.text) {
            gotDelta = true;
            assembledRef.current += event.text;
            if (!ownsView()) continue;
            scheduleFlush();
          } else if (event.type === "done") {
            turnSettled = true;
            if (!ownsView()) continue;
            const reading = event.reading;
            const assembled = assembledRef.current;
            const finalText = reading?.responseText || assembled;
            const followUps = Array.isArray(event.followUps)
              ? event.followUps
                  .filter((q): q is string => typeof q === "string")
                  .map((q) => q.trim())
                  .filter(Boolean)
                  .slice(0, 3)
              : [];
            const summaryLine =
              typeof event.summaryLine === "string"
                ? event.summaryLine.trim() || undefined
                : undefined;
            setThinkingPhase(null);
            // Bind the real row ids onto the optimistic bubbles (keys stay put,
            // so nothing remounts) — this is what makes edit/regenerate work on
            // a turn that was just streamed.
            const serverUserId = event.messageIds?.user ?? undefined;
            const serverAssistantId = event.messageIds?.assistant ?? undefined;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === assistantId) {
                  return {
                    ...m,
                    serverId: serverAssistantId ?? m.serverId,
                    content: finalText,
                    modelId: reading?.modelId ?? DEFAULTS.defaultGeminiModelId,
                    status: "SUCCESS" as const,
                    chartSnapshot: reading?.chartSnapshot ?? null,
                    transitSnapshot: reading?.transitSnapshot ?? null,
                    summaryLine,
                    followUps,
                    elapsedMs:
                      typeof event.elapsedMs === "number"
                        ? event.elapsedMs
                        : m.elapsedMs,
                  };
                }
                if (
                  serverUserId &&
                  optimisticUserId &&
                  m.id === optimisticUserId
                ) {
                  return { ...m, serverId: serverUserId };
                }
                return m;
              }),
            );
            setState("idle");
            setErrorText(null);
            setErrorCode(null);
            setPendingRetry(null);
            processingStartedAtRef.current = null;
            lastDeltaAtRef.current = null;
            if (ownsView()) setLiveAnnounce(finalText);
            void refreshLight();
            void usageRefreshRef.current?.();
          } else if (event.type === "meta") {
            // Follow-up chips + summary land after `done` — attach them to the
            // now-settled answer without touching its text or status.
            if (!ownsView()) continue;
            const followUps = Array.isArray(event.followUps)
              ? event.followUps
                  .filter((q): q is string => typeof q === "string")
                  .map((q) => q.trim())
                  .filter(Boolean)
                  .slice(0, 3)
              : [];
            const summaryLine =
              typeof event.summaryLine === "string"
                ? event.summaryLine.trim() || undefined
                : undefined;
            if (!summaryLine && followUps.length === 0) continue;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, summaryLine, followUps }
                  : m,
              ),
            );
          } else if (event.type === "error") {
            turnSettled = true;
            if (!ownsView()) continue;
            setThinkingPhase(null);
            const code = event.code ?? "AI_PROVIDER_ERROR";
            applyApiError(
              code,
              event.message,
              { setErrorCode, setErrorText, setState, setPendingRetry },
              { question: content, idempotencyKey },
              { hasPendingPayment },
            );
            if (!gotDelta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          event.message || ERROR_MESSAGES.AI_PROVIDER_ERROR,
                        status: "FAILED",
                      }
                    : m,
                ),
              );
            }
          }
        }
      }

      // Stream ended without done — recover via PENDING poll.
      if (!turnSettled) {
        const partial = assembledRef.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: partial || m.content,
                  status: "PENDING" as const,
                  idempotencyKey,
                }
              : m,
          ),
        );
        // Message rows are keyed by assistantId so they are safe to touch, but
        // the chat-wide state belongs to whatever thread is on screen now.
        if (ownsView()) setState("processing");
      }
    } catch (err) {
      const partial = assembledRef.current;
      // User pressed Stop — UI already settled in stopStreaming().
      if (abort.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        // ...or this turn already finished and the abort came from the NEXT send
        // tearing down the (still-open) meta window. Recovering it as a timeout
        // reset the finished answer to an empty PENDING bubble — and `partial`
        // is now the new send's assembledRef, which it just cleared.
        if (explicitStopRef.current || turnSettled) return;
        // Timed out waiting for SSE — server may still be generating; poll it.
        const convId = activeConversationId ?? conversationIdRef.current;
        if (convId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: partial,
                    status: "PENDING" as const,
                    idempotencyKey,
                  }
                : m,
            ),
          );
          if (ownsView()) setState("processing");
          return;
        }
        return;
      }
      // The connection dropped, but the server keeps generating and finalizes
      // the message, so fall back to the PENDING poll rather than erroring out
      // over an answer that is still on its way.
      if (partial) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: partial,
                  status: "PENDING",
                  idempotencyKey,
                }
              : m,
          ),
        );
        if (ownsView()) setState("processing");
        return;
      }
      // Never paint this stream's failure onto a conversation the user has
      // since switched to — it has nothing to do with the error.
      if (!ownsView()) return;
      setErrorCode("NETWORK");
      setErrorText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setState("error");
    } finally {
      // Whatever path we exited on, the turn is settled — a coalesced flush
      // still in flight must not repaint streaming state over the final one.
      turnSettled = true;
      window.clearTimeout(fetchTimeout);
      if (streamAbortRef.current === abort) {
        streamAbortRef.current = null;
      }
      setInFlight(null);
      sendingThreadRef.current = null;
    }
  }

  const showEmpty =
    messages.length === 0 &&
    !locked &&
    state !== "locked" &&
    !loadingThread &&
    !threadId;

  const isBusy = state === "processing" || state === "streaming";

  function startEditMessage(messageId: string, content: string) {
    setEditingMessageId(messageId);
    setInput(content);
    composerRef.current?.focus();
  }

  function regenerateAssistant(localId: string) {
    if (isBusy) return;
    const idx = messages.findIndex((m) => m.id === localId);
    if (idx <= 0) return;
    // The server drops the assistant row by its DB id — a local key won't do.
    const serverId = serverIdOf(messages[idx]);
    if (!serverId) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== "user") return;
    setMessages((prev) => prev.slice(0, idx));
    setErrorText(null);
    setErrorCode(null);
    void send(userMsg.content, { regenerateAssistantMessageId: serverId });
  }

  function retryFailedAssistant(localId: string) {
    if (isBusy) return;
    const idx = messages.findIndex((m) => m.id === localId);
    if (idx <= 0) return;
    const serverId = serverIdOf(messages[idx]);
    if (!serverId) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== "user") return;
    // Truncate, don't just drop this one row: the server (prepareRegenerateAssistant)
    // deletes this message AND everything after it. Filtering only the failed
    // bubble left the later turns on screen while they were gone from the DB —
    // silent data loss, and the retry answer landed under a stale question.
    setMessages((prev) => prev.slice(0, idx));
    void send(userMsg.content, { regenerateAssistantMessageId: serverId });
  }

  function prefillFromChart(prompt: string) {
    setEditingMessageId(null);
    setInput(prompt);
    window.localStorage.setItem(DRAFT_KEY, prompt);
    composerRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Screen readers hear the finished answer here, once. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnounce}
      </div>
      <ChatUsageBar
        usage={usage}
        loading={usageLoading}
        apiReady={usageApiReady}
      />
      {threadMode === "TRANSIT" && threadTransitLabel ? (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-xs text-[var(--muted)] md:px-8">
          โหมดดวงจร · {threadTransitLabel}
        </div>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"
      >
        {!FEATURES.aiChat && (
          <div className="animate-fade-in mx-auto mb-6 max-w-3xl rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-2)] px-4 py-3 text-center text-xs text-[var(--muted)]">
            ตัวอย่างระบบ (เฟสนี้) — ระบบดูดวงด้วย AI จะเปิดให้ใช้งานจริงในเฟสถัดไป
          </div>
        )}
        {loadingThread ? (
          <ChatThreadSkeleton />
        ) : threadLoadError && messages.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center pt-20 text-center">
            <p className="text-sm text-[var(--danger)]">{threadLoadError}</p>
            <a
              href="/dashboard"
              className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)]"
            >
              เริ่มสนทนาใหม่
            </a>
          </div>
        ) : showEmpty ? (
          <div
            key={catSlug ?? "home"}
            className="page-enter mx-auto flex w-full max-w-2xl flex-col items-center"
          >
            <EmptyState
              category={category?.label}
              suggestions={category?.suggestedQuestions ?? []}
              onPick={send}
            />
            {(state === "error" || state === "no-quota") && (
              <div className="mt-4 w-full max-w-md">
                <ErrorBanner
                  state={state}
                  errorCode={errorCode}
                  errorText={errorText}
                  onRetry={
                    pendingRetry &&
                    errorCode &&
                    RETRYABLE_ERRORS.has(errorCode)
                      ? () =>
                          send(
                            pendingRetry.question,
                            pendingRetry.idempotencyKey,
                          )
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        ) : state === "locked" && messages.length === 0 ? (
          <LockedState category={category?.label} />
        ) : (
          <div
            ref={pinToBottomRef}
            className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-2"
          >
            {messages.map((m, idx) => {
              const isStreamingTurn =
                (state === "streaming" || state === "processing") &&
                m.role === "assistant" &&
                idx === messages.length - 1 &&
                m.status === "PENDING";
              // Server-addressed actions (edit/regenerate/retry) only make sense
              // once the row exists — and feedback keys off it so a thumbs-up
              // survives the reload that swaps local ids for real ones.
              const sid = serverIdOf(m);
              return m.role === "user" ? (
                <div key={m.id} className="animate-msg-in group flex flex-col items-end">
                  <div
                    className={`max-w-[min(85%,42rem)] overflow-hidden whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-3 text-[15px] leading-6 text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--border)] ${
                      editingMessageId === m.id
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40"
                        : "bg-[var(--surface-3)]"
                    }`}
                  >
                    {m.content}
                  </div>
                  {!isBusy && sid ? (
                    <MessageActions
                      role="user"
                      messageId={sid}
                      content={m.content}
                      canEdit
                      onEdit={() => startEditMessage(m.id, m.content)}
                    />
                  ) : null}
                </div>
              ) : (
                <div key={m.id} className="animate-msg-in group flex gap-3 sm:gap-4">
                  {/* The assistant speaks as the brand, so it wears the brand —
                      a generic sparkle said nothing about whose answer this is. */}
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--primary)]/35 bg-[var(--surface-2)]"
                    aria-hidden
                  >
                    <BrandMark size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--primary)]">
                      {APP_NAME}
                    </p>
                    {(m.chartSnapshot || m.transitSnapshot) && (
                      <div className="mb-4 flex flex-col gap-2">
                        <div className="flex flex-wrap items-start gap-3">
                          {m.chartSnapshot && (
                            <ExpandableRasiWheel
                              chart={m.chartSnapshot}
                              size={168}
                              label="พื้นดวงเดิม"
                            />
                          )}
                          {m.transitSnapshot && (
                            <ExpandableRasiWheel
                              chart={m.transitSnapshot}
                              size={168}
                              label="ดวงจร"
                            />
                          )}
                        </div>
                        {m.chartSnapshot && (
                          <ChartEvidenceTable
                            chart={m.chartSnapshot}
                            mode="natal"
                            onRowAsk={prefillFromChart}
                          />
                        )}
                        {m.transitSnapshot && (
                          <ChartEvidenceTable
                            chart={m.transitSnapshot}
                            mode="transit"
                            onRowAsk={prefillFromChart}
                          />
                        )}
                      </div>
                    )}
                    {isStreamingTurn && !m.content ? (
                      <ThinkingIndicator
                        phase={thinkingPhase}
                        // The row's own createdAt is the only start time that
                        // survives switching chats, remounting, or a reload.
                        startedAt={
                          m.createdAt
                            ? Date.parse(m.createdAt)
                            : (turnStartedAt ?? undefined)
                        }
                      />
                    ) : (
                      <>
                        {m.summaryLine ? (
                          <div className="mb-3 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-3.5 py-2.5 text-[14px] leading-6 text-[var(--foreground)]">
                            {m.summaryLine}
                          </div>
                        ) : null}
                        <SmoothStreamMarkdown
                          content={m.content}
                          streaming={isStreamingTurn}
                        />
                      </>
                    )}
                    {!isStreamingTurn && m.content && (
                      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[var(--border)]/70 pt-2">
                        {!isBusy && sid ? (
                          <MessageActions
                            role="assistant"
                            messageId={sid}
                            content={m.content}
                            canRegenerate={m.status !== "PENDING"}
                            failed={m.status === "FAILED" || m.status === "TIMEOUT"}
                            onRegenerate={() => regenerateAssistant(m.id)}
                            onRetry={
                              m.status === "FAILED" || m.status === "TIMEOUT"
                                ? () => retryFailedAssistant(m.id)
                                : undefined
                            }
                            feedback={feedbackById[sid] ?? null}
                            onFeedback={(value) => setMessageFeedback(sid, value)}
                          />
                        ) : (
                          <CopyMessageButton text={m.content} />
                        )}
                        {m.modelId && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-[var(--muted-2)]">
                            ตอบโดย {modelLabel(m.modelId)}
                          </span>
                        )}
                        {m.elapsedMs != null && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-2)]">
                            · ใช้เวลา {formatElapsed(Math.round(m.elapsedMs / 1000))}
                          </span>
                        )}
                      </div>
                    )}
                    {!isBusy &&
                    !isStreamingTurn &&
                    m.status === "SUCCESS" &&
                    m.followUps &&
                    m.followUps.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.followUps.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => void send(q)}
                            className="press-scale max-w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-left text-xs text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!isStreamingTurn && (
                      <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-2)]">
                        คำทำนายนี้มีไว้เพื่อความบันเทิงและเป็นแนวทางเท่านั้น
                        ไม่ใช่คำแนะนำทางการเงิน กฎหมาย หรือการแพทย์
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {state === "processing" &&
              !(
                messages[messages.length - 1]?.role === "assistant" &&
                messages[messages.length - 1]?.status === "PENDING"
              ) && (
                <ThinkingIndicator
                  phase={thinkingPhase}
                  startedAt={turnStartedAt ?? undefined}
                />
              )}
            {(state === "error" || state === "no-quota") && (
              <ErrorBanner
                state={state}
                errorCode={errorCode}
                errorText={errorText}
                onRetry={
                  pendingRetry &&
                  errorCode &&
                  RETRYABLE_ERRORS.has(errorCode)
                    ? () => send(pendingRetry.question, pendingRetry.idempotencyKey)
                    : undefined
                }
              />
            )}
          </div>
        )}
        {/* Feedback lives on one message, so its failure belongs next to the
            thread, not in the chat-wide ErrorBanner (which would read as if the
            ANSWER failed). Silent was the worst option: a thumb that lights up
            and pops back off is indistinguishable from a dead button. */}
        {feedbackError ? (
          <div
            role="status"
            className="animate-fade-in absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[var(--danger)]/40 bg-[var(--surface)]/95 px-3.5 py-1.5 text-xs text-[var(--danger)] shadow-md backdrop-blur"
          >
            {feedbackError}
            <button
              type="button"
              onClick={() => setFeedbackError(null)}
              className="ml-2 text-[var(--muted-2)] hover:text-[var(--foreground)]"
              aria-label="ปิด"
            >
              ✕
            </button>
          </div>
        ) : null}
        {showScrollFab ? (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="press-scale absolute bottom-3 right-3 z-20 flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--foreground)] shadow-md backdrop-blur transition hover:border-[var(--primary)] md:bottom-4 md:right-4"
            aria-label="เลื่อนลงล่างสุด"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 5v14M6 13l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="relative shrink-0">
        {editingMessageId ? (
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 pb-2 md:px-8">
            <p className="text-xs text-[var(--muted)]">กำลังแก้ไขข้อความ — ส่งเพื่อถามใหม่จากจุดนี้</p>
            <button
              type="button"
              onClick={() => {
                setEditingMessageId(null);
                setInput("");
              }}
              className="text-xs text-[var(--muted-2)] underline hover:text-[var(--foreground)]"
            >
              ยกเลิก
            </button>
          </div>
        ) : null}
        <Composer
          ref={composerRef}
          value={input}
          onChange={setInput}
          onSend={() => send(input, editingMessageId ? { editUserMessageId: editingMessageId } : undefined)}
          onStop={() => void stopStreaming(stopTarget)}
          // Stop is offered only while an answer is genuinely in progress AND we
          // hold a handle to cancel it. Keying off the target alone let a stale
          // PENDING row keep the button up long after the answer had landed.
          streaming={
            (state === "processing" || state === "streaming") &&
            Boolean(stopTarget) &&
            !stopping
          }
          disabled={locked || state === "locked"}
          // Keep the field editable while streaming (ChatGPT-style). Send is
          // blocked in send() until the turn settles; Stop replaces the arrow.
          aiEnabled={FEATURES.aiChat}
          categoryLocked={locked}
          creditCost={
            usage?.creditCostPerMessage ?? DEFAULTS.creditCostPerReading
          }
          creditBalance={usage?.balance ?? user?.creditBalance ?? 0}
          answerMode={answerMode}
          onAnswerModeChange={updateAnswerMode}
        />
      </div>
    </div>
  );
}

function ErrorBanner({
  state,
  errorCode,
  errorText,
  onRetry,
}: {
  state: "error" | "no-quota";
  errorCode: string | null;
  errorText: string | null;
  onRetry?: () => void;
}) {
  const showUpgrade =
    state === "no-quota" ||
    (errorCode != null && UPGRADE_ERRORS.has(errorCode));
  const quotaExceeded = errorCode === "QUOTA_EXCEEDED";
  const showBirthProfile =
    errorCode === "VALIDATION" && errorText === ERROR_MESSAGES.VALIDATION;

  return (
    <div className="animate-fade-in flex flex-col items-start gap-2">
      <p className="text-sm text-[var(--danger)]">
        {errorText ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"}
      </p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="press-scale rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
          >
            ลองใหม่
          </button>
        )}
        {showUpgrade && (
          <a
            href="/account"
            className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            {quotaExceeded
              ? "ดูแพ็กเกจ / รอวันใหม่"
              : state === "no-quota"
                ? "ดูแพ็กเกจ / เติมเครดิต"
                : "อัปเกรดเป็น Pro"}
          </a>
        )}
        {showBirthProfile && (
          <a
            href="/onboarding"
            className="press-scale rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
          >
            กรอกข้อมูลวันเกิด
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  category,
  suggestions,
  onPick,
}: {
  category?: string;
  suggestions: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-6 text-center">
      {/* Scrolls with empty home — not pinned above every thread */}
      <NatalChartBanner />
      <h1 className="animate-fade-up whitespace-pre-line text-xl font-semibold leading-relaxed text-[var(--primary)] sm:text-2xl">
        {EMPTY_HEADING}
      </h1>
      <p className="animate-fade-up stagger-1 mt-3 text-sm leading-relaxed text-[var(--muted)]">
        {EMPTY_PARAGRAPH}
      </p>

      {category && (
        <p className="animate-fade-up stagger-2 mt-6 text-xs text-[var(--muted-2)]">
          หัวข้อ: {category}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((q, i) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className={`animate-fade-up stagger-${Math.min(i + 2, 6)} press-scale rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-xs text-[var(--muted)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--foreground)]`}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LockedState({ category }: { category?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center pt-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--primary)]/40 text-[var(--primary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        หมวด{category ? `“${category}”` : "นี้"}สำหรับสมาชิก Pro
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        อัปเกรดเป็น Pro เพื่อปลดล็อกหมวดนี้และโหมดดวงจร
      </p>
      <a
        href="/account"
        className="mt-5 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
      >
        อัปเกรดเป็น Pro
      </a>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} วินาที`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")} นาที`;
}

/**
 * @param startedAt epoch ms the turn actually began (the PENDING row's
 *   createdAt, or the send timestamp). Timing off mount instead reset the
 *   counter to zero every time this remounted — switch chats and come back and
 *   a 90-second turn claimed it had been running for 2.
 */
function ThinkingIndicator({
  phase,
  startedAt,
}: {
  phase?: ThinkingPhase | null;
  startedAt?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const label =
    phase && THINKING_PHASE_LABEL[phase]
      ? THINKING_PHASE_LABEL[phase]
      : "กำลังเพ่งดวงดาว…";

  useEffect(() => {
    const started = startedAt ?? Date.now();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div className="animate-fade-in flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <div className="flex items-end gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="wave-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <span className="shimmer-text text-xs font-medium">{label}</span>
      </div>
      <p className="pl-0 text-[11px] tabular-nums text-[var(--muted-2)]">
        ใช้เวลาไปแล้ว{" "}
        <span className="font-medium text-[var(--muted)]">
          {formatElapsed(elapsed)}
        </span>
        {elapsed >= 30 ? (
          <span className="ml-1 opacity-80">· ระบบกำลังคำนวณดวงและเรียก AI</span>
        ) : null}
      </p>
    </div>
  );
}


const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onStop: () => void;
    streaming: boolean;
    disabled: boolean;
    aiEnabled: boolean;
    categoryLocked?: boolean;
    creditCost?: number;
    creditBalance?: number;
    answerMode: AnswerMode;
    onAnswerModeChange: (mode: AnswerMode) => void;
  }
>(function Composer(
  {
    value,
    onChange,
    onSend,
    onStop,
    streaming,
    disabled,
    aiEnabled,
    categoryLocked,
    creditCost,
    creditBalance,
    answerMode,
    onAnswerModeChange,
  },
  ref,
) {
  const placeholder = !aiEnabled
    ? "เปิดให้ใช้งานในเฟสถัดไป"
    : categoryLocked
      ? "หมวดนี้สำหรับ Pro — เลือก「ตัวตน」หรือ「การงาน」หรืออัปเกรด"
      : "สอบถามเราได้เลย — Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่";

  useEffect(() => {
    const el = ref && "current" in ref ? ref.current : null;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${Math.max(next, 24)}px`;
  }, [value, ref]);

  return (
    <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8">
      <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-2">
        <div
          className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-[11px]"
          role="group"
          aria-label="โหมดคำตอบ"
        >
          <button
            type="button"
            onClick={() => onAnswerModeChange("brief")}
            disabled={!aiEnabled}
            className={`rounded-md px-3 py-1 transition ${
              answerMode === "brief"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            กระชับ
          </button>
          <button
            type="button"
            onClick={() => onAnswerModeChange("detailed")}
            disabled={!aiEnabled}
            className={`rounded-md px-3 py-1 transition ${
              answerMode === "detailed"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            ละเอียด
          </button>
        </div>
        {aiEnabled && creditCost != null && creditCost > 0 ? (
          <p className="text-[11px] text-[var(--muted)]">
            ใช้ {creditCost} เครดิต · คงเหลือ {creditBalance ?? 0}
          </p>
        ) : null}
      </div>
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-shadow duration-300 focus-within:border-[var(--primary)]/50 focus-within:shadow-[0_0_0_3px_var(--ring)]">
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={!aiEnabled}
          placeholder={placeholder}
          // text-base (16px) on mobile: iOS Safari zooms the whole page when a
          // focused input is under 16px, so the composer must not be text-sm
          // there. md:text-sm keeps the desktop size.
          className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent text-base leading-6 text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none disabled:cursor-not-allowed md:text-sm"
        />
        <button
          type="button"
          disabled
          title="ฟีเจอร์เสียง (Phase 2)"
          className="cursor-not-allowed text-[var(--muted-2)] opacity-50"
          aria-label="โทร (เร็ว ๆ นี้)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </button>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="press-scale flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)] transition hover:opacity-80"
            aria-label="หยุดคำตอบ"
            title="หยุดคำตอบ"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2.5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !aiEnabled || categoryLocked || !value.trim()}
            className="press-scale flex shrink-0 items-center justify-center text-[var(--primary)] transition hover:text-[var(--primary-hover)] disabled:opacity-40"
            aria-label="ส่ง"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.4 20.4l17.6-8.4a.9.9 0 0 0 0-1.6L3.4 2A.7.7 0 0 0 2.4 3l2.3 6.9c.1.4.4.6.8.7l7.3 1c.2 0 .2.3 0 .4l-7.3 1c-.4 0-.7.3-.8.7L2.4 21a.7.7 0 0 0 1 .9z" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--muted-2)]">
        Horasard อาจให้ข้อมูลที่ไม่ถูกต้องเสมอไป โปรดใช้วิจารณญาณ
      </p>
    </div>
  );
});
