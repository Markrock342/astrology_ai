"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  forwardRef,
} from "react";
import { APP_NAME, DEFAULTS } from "@/config/constants";
import { FEATURES } from "@/config/features";
import { ChatThreadSkeleton } from "@/components/app/content-skeleton";
import {
  isCategoryLocked,
  useAppData,
  useCategory,
} from "./app-data-provider";
import { BrandMark } from "@/components/brand-logo";
import { softNavigate, useChatRouteSearchParams, isPlainLeftClick } from "./chat-nav";
import { ExpandableRasiWheel } from "./expandable-rasi-wheel";
import { HoroscopeChartPanel } from "./horoscope-chart-panel";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { CopyMessageButton } from "./copy-message-button";
import { MessageActions } from "./message-actions";
import { SmoothStreamMarkdown } from "./smooth-stream-markdown";
import { useMyUsage } from "@/hooks/use-my-usage";
import type { ChartJson } from "@/types/chart";
import { isCategoryIntroQuestion } from "@/lib/intake-survey";
import {
  UNIFIED_CHAT_CATEGORY_SLUG,
  detectMentionedCategories,
} from "@/lib/question-scope";
import {
  getCachedThread,
  prefetchThread,
  setCachedThread,
  type CachedChatMessage,
} from "./thread-cache";
import {
  ASK_FROM_CHART_EVENT,
  readAskFromChartDetail,
} from "@/lib/chat-navigation-links";
import { NatalChartReferenceView } from "./natal-chart-reference-view";

type ThinkingPhase = "chart" | "memory" | "writing";
type AnswerMode = "brief" | "detailed";
type FeedbackValue = "up" | "down";

// Coarse-pointer (touch) detection as an external store — the compiler-safe way
// to read matchMedia without setState-in-effect. Drives the composer hint, which
// must not mention Shift+Enter on phones that have no such shortcut.
function subscribeCoarsePointer(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function getCoarsePointerSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

const THINKING_PHASE_LABEL: Record<ThinkingPhase, string> = {
  chart: "กำลังคำนวณพื้นดวง…",
  memory: "กำลังวิเคราะห์เรือนและดาว…",
  writing: "กำลังเขียนคำทำนาย…",
};

const ANSWER_MODE_KEY = "horasard:answerMode";
const DRAFT_KEY = "horasard:chatDraft";
const FEEDBACK_KEY = "horasard:messageFeedback";

/** Survives React Strict Mode remounts so a category intro is not double-sent. */
const natalIntroStarted = new Set<string>();

/** Wall-clock helper kept outside the component so React purity lint ignores it. */
function nowMs(): number {
  return Date.now();
}

function readAnswerMode(plan: "FREE" | "PRO" = "FREE"): AnswerMode {
  if (typeof window === "undefined") return plan === "PRO" ? "detailed" : "brief";
  const saved = window.localStorage.getItem(ANSWER_MODE_KEY);
  if (saved === "brief" || saved === "detailed") return saved;
  // Free defaults to brief — burns fewer tokens on the 3-credit trial.
  return plan === "PRO" ? "detailed" : "brief";
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
  /** Ms from send to the first streamed character, measured on this client. */
  firstTokenMs?: number;
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
  NO_QUOTA:
    "usage หมดแล้ว — เติม usage เพื่อถามต่อ หรืออัปเกรด Pro หากยังใช้แพ็กทดลอง",
  CATEGORY_LOCKED:
    "หมวดนี้ใช้ได้ใน Pro — แพ็ก Free ใช้หมวด「ตัวตน」กับ「การงาน」ได้",
  CHAT_REQUIRES_PRO: "ต้องอัปเกรดเป็น Pro ก่อนจึงจะสนทนากับ AI ได้",
  CHAT_REQUIRES_PRO_PENDING:
    "สลิปของคุณอยู่ระหว่างตรวจสอบ ปกติภายใน 1–2 วันทำการ — หลังอนุมัติจะแชทได้ทันที",
  TRANSIT_REQUIRES_PRO:
    "ดวงจรใช้ได้ใน Pro — อัปเกรดแล้วเริ่มถามได้ทุกหมวด",
  FOLLOWUP_REQUIRES_PRO:
    "ถามต่อในบทสนทนาเดิมสำหรับสมาชิก Pro — เริ่มคำถามใหม่ได้ตราบใดที่ยังมี usage",
  EMAIL_NOT_VERIFIED:
    "ยืนยันอีเมลก่อนใช้ usage ทดลอง — เช็กกล่องจดหมายของคุณได้เลย",
  CHART_NOT_READY:
    "ยังคำนวณพื้นดวงไม่สำเร็จ กรุณาตรวจสอบข้อมูลวันเกิดแล้วลองใหม่",
  AI_TIMEOUT: "หมอดูใช้เวลานานเกินไป ลองถามใหม่อีกครั้ง (ไม่ถูกหัก usage)",
  AI_PROVIDER_ERROR: "ระบบทำนายขัดข้องชั่วคราว ลองใหม่อีกครั้ง (ไม่ถูกหัก usage)",
  VALIDATION: "กรุณากรอกข้อมูลวันเกิดก่อนเริ่มดูดวง",
  RATE_LIMITED: "ถามถี่เกินไป รอสักครู่แล้วลองใหม่",
  QUOTA_EXCEEDED:
    "ถึงเพดานป้องกันการใช้งานของรอบนี้แล้ว กรุณารอรีเซ็ตหรือติดต่อแอดมิน",
  UNAUTHENTICATED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  USER_DISABLED: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อแอดมิน",
  FEATURE_DISABLED: "ระบบดูดวงด้วย AI กำลังอยู่ระหว่างพัฒนา",
  NATAL_QA_DISABLED:
    "ถามต่อในแชทนี้ได้เลย",
};

function modelLabel(modelId: string): string {
  return modelId
    .split("-")
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

type PendingRetry = {
  question: string;
  idempotencyKey: string;
};

type ScopeTarget = {
  slug: string;
  label: string;
  requiresPro: boolean;
};

type SendOpts = {
  retryKey?: string;
  editUserMessageId?: string;
  regenerateAssistantMessageId?: string;
  purpose?: "category_intro";
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
  if (/myhora|scrap(?:e|ed|ing)?|formula-pipeline/i.test(trimmed)) {
    return fallback;
  }
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
    setScopeTarget?: (target: ScopeTarget | null) => void;
  },
  retry: PendingRetry | null,
  opts?: { hasPendingPayment?: boolean; details?: unknown },
) {
  setters.setErrorCode(code);
  const details = opts?.details as
    | (Partial<ScopeTarget> & {
        targetSlug?: string;
        targetLabel?: string;
      })
    | undefined;
  const detailSlug = details?.slug ?? details?.targetSlug;
  const detailLabel = details?.label ?? details?.targetLabel;
  setters.setScopeTarget?.(
    code === "CATEGORY_SCOPE_MISMATCH" &&
      typeof detailSlug === "string" &&
      typeof detailLabel === "string"
      ? {
          slug: detailSlug,
          label: detailLabel,
          requiresPro: Boolean(details?.requiresPro),
        }
      : null,
  );
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
  const searchParams = useChatRouteSearchParams();
  const catSlug = searchParams.get("cat");
  const threadId = searchParams.get("thread");
  const showingNatalChart =
    searchParams.get("view") === "natal-chart" && !threadId;
  const {
    user,
    categories,
    refreshLight,
    pendingPayment,
    natalThreads,
  } = useAppData();
  const category = useCategory(catSlug);
  const locked = isCategoryLocked(category, user?.plan ?? "FREE");
  const hasPendingPayment = Boolean(pendingPayment);
  const { usage, refresh: refreshUsage } = useMyUsage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("brief");
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
  const [scopeTarget, setScopeTarget] = useState<ScopeTarget | null>(null);
  const [scopeForwardingLabel, setScopeForwardingLabel] = useState<string | null>(
    null,
  );
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

  useEffect(() => {
    function onAsk(event: Event) {
      const prompt = readAskFromChartDetail(event);
      if (!prompt) return;
      setEditingMessageId(null);
      setInput(prompt);
      window.localStorage.setItem(DRAFT_KEY, prompt);
      composerRef.current?.focus();
    }
    window.addEventListener(ASK_FROM_CHART_EVENT, onAsk);
    return () => window.removeEventListener(ASK_FROM_CHART_EVENT, onAsk);
  }, []);

  // Hydrate answer mode, draft, and thumbs from localStorage once on mount /
  // when plan is known (Free defaults to brief to stretch trial credits).
  useEffect(() => {
    const plan = user?.plan === "PRO" ? "PRO" : "FREE";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydrate
    setAnswerMode(readAnswerMode(plan));
    setFeedbackById(readFeedbackMap());
    if (!draftHydratedRef.current) {
      draftHydratedRef.current = true;
      const draft = readDraft();
      if (draft) setInput(draft);
    }
  }, [user?.plan]);

  // Free + ≤1 credit: detailed is disabled in Composer, but localStorage can
  // still leave answerMode on "detailed" — force brief so send() matches the UI.
  const usageRemainingPercent =
    usage?.remainingPercent ?? user?.usageRemainingPercent ?? 0;

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
        "ใช้เวลานานผิดปกติ — กดลองใหม่ (ยังไม่หัก usage ถ้ายังไม่มีคำตอบ)",
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
        "ใช้เวลานานเกินไป — ลองถามใหม่อีกครั้ง (ยังไม่หัก usage ถ้ายังไม่มีคำตอบ)",
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

  // New chat is a blank composer — no auto natal briefing, no category pick.
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
    setScopeForwardingLabel(null);
    setState(locked ? "locked" : "idle");
    setInput("");
    setErrorText(null);
    setErrorCode(null);
    setPendingRetry(null);
    setThreadLoadError(null);
  }, [catSlug, locked, threadId]);

  // Natal auto-intro removed: home is ready to type, one chat covers every topic.

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
    if (loadingThread || showingNatalChart) return;
    composerRef.current?.focus();
  }, [threadId, catSlug, loadingThread, showingNatalChart]);

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
    purpose?: "category_intro",
  ): Promise<string | null> {
    const existing = threadId ?? conversationIdRef.current;
    if (existing) return existing;

    if (purpose === "category_intro") {
      const match = natalThreads.find((t) => t.categorySlug === categorySlug);
      if (match) {
        conversationIdRef.current = match.id;
        return match.id;
      }
    }

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categorySlug: categorySlug || UNIFIED_CHAT_CATEGORY_SLUG,
        mode: "TRANSIT",
      }),
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
    if (scopeForwardingLabel) return;

    const isIntro =
      options.purpose === "category_intro" || isCategoryIntroQuestion(content);
    const categorySlug =
      catSlug ?? threadCategorySlug ?? UNIFIED_CHAT_CATEGORY_SLUG;
    const introStamp =
      isIntro && (catSlug ?? threadCategorySlug)
        ? `${user?.email ?? "anon"}:${catSlug ?? threadCategorySlug}`
        : null;
    const releaseIntroStamp = () => {
      if (introStamp) natalIntroStarted.delete(introStamp);
    };

    // Composer locks on emailGate, but chips / 「เล่าต่อ」 call send() directly —
    // mirror the gate here so Free + unverified never hits the API.
    // Natal intros are free and skip this wall.
    if (!isIntro && user?.needsEmailVerification && user?.plan !== "PRO") {
      setErrorCode("EMAIL_NOT_VERIFIED");
      setErrorText(
        "ยืนยันอีเมลก่อนใช้ usage ทดลอง — เช็กกล่องจดหมาย หรือกดส่งใหม่ที่แถบด้านบน",
      );
      setState("error");
      setPendingRetry(null);
      return;
    }

    if (!isIntro && user?.plan !== "PRO") {
      const mentioned = detectMentionedCategories(content);
      const lockedCat = categories.find(
        (item) =>
          mentioned.includes(item.slug as (typeof mentioned)[number]) && isCategoryLocked(item, "FREE"),
      );
      if (lockedCat) {
        setScopeTarget({
          slug: lockedCat.slug,
          label: lockedCat.label,
          requiresPro: true,
        });
        setErrorCode("CATEGORY_LOCKED");
        setErrorText(
          `หมวด「${lockedCat.label}」ใช้ได้ใน Pro — อัปเกรดเพื่อถามเรื่องนี้`,
        );
        setState("error");
        setPendingRetry(null);
        return;
      }
    }

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

    const isRetry = Boolean(options.retryKey);
    const isRegenerate = Boolean(options.regenerateAssistantMessageId);
    if (introStamp && !isRetry && !isRegenerate) {
      if (natalIntroStarted.has(introStamp)) return;
      natalIntroStarted.add(introStamp);
    }
    // Local id: the server row does not exist yet. `done` brings back the real
    // one and we bind it as serverId (see serverIdOf).
    let optimisticUserId: string | null = null;
    if (!isRetry && !isRegenerate && !editLocalId && !isIntro) {
      optimisticUserId = `local-${crypto.randomUUID()}`;
      const userMsg: Message = { id: optimisticUserId, role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      window.localStorage.removeItem(DRAFT_KEY);
    }

    setErrorText(null);
    setErrorCode(null);
    setScopeTarget(null);
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
    // When the first character arrived — the number that says whether a slow
    // turn was slow to START or just a long answer being written. An object
    // property, not a let: it is read inside a setState updater, and the React
    // Compiler freezes plain captured variables there.
    const firstDelta = { atMs: null as number | null };
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
        ? await ensureConversation(
            categorySlug,
            content,
            idempotencyKey,
            options.purpose,
          )
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
        releaseIntroStamp();
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
        // "the page refreshed while it was typing" flash. softNavigate uses a
        // plain history state + horasard:soft-nav so useChatRouteSearchParams
        // picks up threadId without remounting.
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

      // Free + ≤1 credit: never send detailed even if localStorage still has it.
      const effectiveAnswerMode: AnswerMode =
        answerMode;

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
            answerMode: isIntro ? "detailed" : effectiveAnswerMode,
            purpose: isIntro ? "category_intro" : undefined,
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
            {
              setErrorCode,
              setErrorText,
              setState,
              setPendingRetry,
              setScopeTarget,
            },
            { question: content, idempotencyKey },
            { hasPendingPayment, details: json?.error?.details },
          );
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          releaseIntroStamp();
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
            threadTitle?: string;
            truncated?: boolean;
            chartSnapshot?: ChartJson | null;
            transitSnapshot?: ChartJson | null;
            details?: unknown;
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
          } else if (event.type === "charts" && event.chartSnapshot) {
            // Charts are deterministic engine output, not model prose. Paint
            // them as soon as chart preparation finishes instead of waiting
            // for the final `done` frame after a potentially long generation.
            if (!ownsView()) continue;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      chartSnapshot: event.chartSnapshot,
                      transitSnapshot: event.transitSnapshot ?? null,
                    }
                  : message,
              ),
            );
          } else if (event.type === "delta" && event.text) {
            if (!gotDelta) firstDelta.atMs = nowMs();
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
            // Read the START time from the ref, NOT the captured `turnStartedAt`
            // state. `send` is a per-render closure: on turn #2+ it captures the
            // PREVIOUS turn's `turnStartedAt` (state is never reset between
            // turns), so `nowMs() - turnStartedAt` measured from the last
            // question and showed "ใช้เวลา 5:08 นาที". The ref is stamped fresh
            // at the top of THIS send (processingStartedAtRef.current = nowMs()).
            const started = processingStartedAtRef.current;
            // Computed OUTSIDE the setMessages updater: the React Compiler
            // freezes captures inside state updaters, so the mutable tracking
            // object cannot be read in there.
            const ttftMs =
              firstDelta.atMs !== null && started !== null
                ? firstDelta.atMs - started
                : undefined;
            // Same clock for both numbers. The server's elapsedMs starts when
            // the ROUTE starts, the client's TTFT starts at SEND — mixing them
            // produced "ใช้เวลา 7 วิ (เริ่มตอบใน 18 วิ)", which reads as
            // nonsense. The user's clock is the one they experienced.
            const clientElapsedMs =
              started !== null ? nowMs() - started : undefined;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === assistantId) {
                  return {
                    ...m,
                    serverId: serverAssistantId ?? m.serverId,
                    content: finalText,
                    modelId: reading?.modelId ?? DEFAULTS.defaultGeminiModelId,
                    status: "SUCCESS" as const,
                    chartSnapshot:
                      reading?.chartSnapshot ?? m.chartSnapshot ?? null,
                    transitSnapshot:
                      reading?.transitSnapshot ?? m.transitSnapshot ?? null,
                    summaryLine,
                    followUps,
                    elapsedMs:
                      clientElapsedMs ??
                      (typeof event.elapsedMs === "number"
                        ? event.elapsedMs
                        : m.elapsedMs),
                    firstTokenMs: ttftMs ?? m.firstTokenMs,
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
            // The AI just named this thread; the sidebar is still showing the
            // truncated question. Refresh it.
            if (event.threadTitle) void refreshLight();
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
              {
                setErrorCode,
                setErrorText,
                setState,
                setPendingRetry,
                setScopeTarget,
              },
              { question: content, idempotencyKey },
              { hasPendingPayment, details: event.details },
            );
            releaseIntroStamp();
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
      releaseIntroStamp();
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
  const emailGate =
    Boolean(user?.needsEmailVerification) && user?.plan !== "PRO";
  const availableCategories = categories.filter(
    (item) => !isCategoryLocked(item, user?.plan ?? "FREE"),
  );

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
    void send(userMsg.content, {
      regenerateAssistantMessageId: serverId,
      purpose: isCategoryIntroQuestion(userMsg.content)
        ? "category_intro"
        : undefined,
    });
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
    void send(userMsg.content, {
      regenerateAssistantMessageId: serverId,
      purpose: isCategoryIntroQuestion(userMsg.content)
        ? "category_intro"
        : undefined,
    });
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
      {showingNatalChart ? (
        <ReadingContextBar mode="reference" category={category?.label} />
      ) : threadMode === "TRANSIT" ? (
        <ReadingContextBar
          mode="transit"
          category={category?.label}
          detail={threadTransitLabel}
        />
      ) : category ? (
        <ReadingContextBar mode="natal" category={category.label} />
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
        {showingNatalChart ? (
          <NatalChartReferenceView />
        ) : loadingThread ? (
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
              categories={availableCategories}
              plan={user?.plan ?? "FREE"}
              onPick={send}
              emailGate={emailGate}
            />
            {(state === "error" || state === "no-quota") && (
              <div className="mt-4 w-full max-w-md">
                <ErrorBanner
                  state={state}
                  errorCode={errorCode}
                  errorText={errorText}
                  scopeTarget={scopeTarget}
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
              // The natal chart never changes within a thread, so the wheel +
              // evidence table ride only the FIRST answer that carries one.
              // Repeating the same 10-row table above every reply buried the
              // actual answers under identical boilerplate.
              const isFirstChartMessage =
                (m.chartSnapshot || m.transitSnapshot) &&
                messages.findIndex(
                  (x) => x.chartSnapshot || x.transitSnapshot,
                ) === idx;
              const isStreamingTurn =
                (state === "streaming" || state === "processing") &&
                m.role === "assistant" &&
                idx === messages.length - 1 &&
                m.status === "PENDING";
              // Server-addressed actions (edit/regenerate/retry) only make sense
              // once the row exists — and feedback keys off it so a thumbs-up
              // survives the reload that swaps local ids for real ones.
              const sid = serverIdOf(m);
              if (m.role === "user" && isCategoryIntroQuestion(m.content)) {
                return null;
              }
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
                <div key={m.id} className="animate-msg-in group flex flex-col gap-1.5 sm:flex-row sm:gap-4">
                  {/* The assistant speaks as the brand, so it wears the brand —
                      a generic sparkle said nothing about whose answer this is.
                      On phones the avatar rides the name as a header row so the
                      answer body drops to full width below it; only on sm+ does
                      the avatar become a left column that indents the text. */}
                  <div className="flex items-center gap-2 sm:block">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--primary)]/35 bg-[var(--surface-2)] sm:mt-0.5 sm:h-8 sm:w-8"
                      aria-hidden
                    >
                      <BrandMark size={18} />
                    </div>
                    <p className="text-xs font-semibold tracking-wide text-[var(--primary)] sm:hidden">
                      {APP_NAME}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 hidden text-xs font-semibold tracking-wide text-[var(--primary)] sm:block">
                      {APP_NAME}
                    </p>
                    {isFirstChartMessage && (
                      <div className="mb-4 flex flex-col gap-2">
                        {m.chartSnapshot ? (
                          <HoroscopeChartPanel
                            natal={m.chartSnapshot}
                            transit={m.transitSnapshot}
                          />
                        ) : m.transitSnapshot ? (
                          <div className="flex flex-wrap items-start gap-3">
                            <ExpandableRasiWheel
                              chart={m.transitSnapshot}
                              size={168}
                              label="ดวงจร"
                            />
                          </div>
                        ) : null}
                        {m.chartSnapshot && (
                          <ChartEvidenceTable
                            chart={m.chartSnapshot}
                            mode="natal"
                            onRowAsk={
                              threadMode === "TRANSIT" ? prefillFromChart : undefined
                            }
                          />
                        )}
                        {m.transitSnapshot && (
                          <ChartEvidenceTable
                            chart={m.transitSnapshot}
                            mode="transit"
                            onRowAsk={
                              threadMode === "TRANSIT" ? prefillFromChart : undefined
                            }
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
                            canRegenerate={
                              m.status !== "PENDING" &&
                              (threadMode === "TRANSIT" ||
                                isCategoryIntroQuestion(
                                  messages[idx - 1]?.content ?? "",
                                ))
                            }
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
                            {m.firstTokenMs != null
                              ? ` (เริ่มตอบใน ${Math.max(1, Math.round(m.firstTokenMs / 1000))} วิ)`
                              : ""}
                          </span>
                        )}
                      </div>
                    )}
                    {!isBusy && !isStreamingTurn && m.status === "SUCCESS" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* A truncated answer told the user to TYPE "เล่าต่อ".
                            Asking someone to type what a button should do is a
                            button that doesn't exist yet — here it is. The
                            notice text the server appends IS the signal. */}
                        {m.content.includes("เพดานของโหมดคำตอบ") ? (
                          <button
                            type="button"
                            disabled={emailGate}
                            onClick={() => void send("เล่าต่อ")}
                            className="press-scale rounded-full border border-[var(--primary)]/50 bg-[var(--primary)]/10 px-3.5 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            เล่าต่อ ▸
                          </button>
                        ) : null}
                        {(m.followUps ?? []).map((q) => (
                          <button
                            key={q}
                            type="button"
                            disabled={emailGate}
                            onClick={() => void send(q)}
                            className="press-scale max-w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-left text-xs text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
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
                scopeTarget={scopeTarget}
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

      {showingNatalChart ? null : (
      <div className="relative shrink-0">
          {editingMessageId ? (
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 pb-2 md:px-8">
              <p className="text-xs text-[var(--muted)]">
                กำลังแก้ไขข้อความ — ส่งเพื่อถามใหม่จากจุดนี้
              </p>
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
          {scopeForwardingLabel ? (
            <div
              role="status"
              aria-live="polite"
              className="mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-3 text-sm text-[var(--foreground)]"
            >
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)]"
                aria-hidden
              />
              กำลังย้ายคำถามไปหมวด「{scopeForwardingLabel}」และส่งให้ AI…
            </div>
          ) : null}
          <Composer
              ref={composerRef}
              value={input}
              onChange={setInput}
              onSend={() =>
                send(
                  input,
                  editingMessageId
                    ? { editUserMessageId: editingMessageId }
                    : undefined,
                )
              }
              onStop={() => void stopStreaming(stopTarget)}
              streaming={
                (state === "processing" || state === "streaming") &&
                Boolean(stopTarget) &&
                !stopping
              }
              disabled={
                locked ||
                state === "locked" ||
                Boolean(scopeForwardingLabel)
              }
              aiEnabled={FEATURES.aiChat}
              categoryLocked={locked}
              usageRemainingPercent={usageRemainingPercent}
              plan={user?.plan === "PRO" ? "PRO" : "FREE"}
              needsEmailVerification={Boolean(user?.needsEmailVerification)}
              answerMode={answerMode}
              onAnswerModeChange={updateAnswerMode}
            />
        </div>
      )}
    </div>
  );
}

function ErrorBanner({
  state,
  errorCode,
  errorText,
  scopeTarget,
  onRetry,
}: {
  state: "error" | "no-quota";
  errorCode: string | null;
  errorText: string | null;
  scopeTarget?: ScopeTarget | null;
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
        {errorCode === "CATEGORY_SCOPE_MISMATCH" && scopeTarget ? (
          <a
            href={
              scopeTarget.requiresPro
                ? "/account"
                : `/dashboard?cat=${scopeTarget.slug}`
            }
            onClick={(event) => {
              if (scopeTarget.requiresPro) return;
              if (
                isPlainLeftClick(event) &&
                softNavigate(`/dashboard?cat=${scopeTarget.slug}`)
              ) {
                event.preventDefault();
              }
            }}
            className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            {scopeTarget.requiresPro
              ? `ปลดล็อกหมวด${scopeTarget.label}`
              : `เปิดหมวด${scopeTarget.label}`}
          </a>
        ) : null}
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
                ? "อัปเกรด / ดูแพ็กเกจ"
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
  categories,
  plan,
  onPick,
  emailGate = false,
}: {
  categories: Array<{
    slug: string;
    label: string;
    suggestedQuestions?: string[];
  }>;
  plan: "FREE" | "PRO";
  onPick: (q: string) => void;
  emailGate?: boolean;
}) {
  const suggestions = categories
    .flatMap((item) => item.suggestedQuestions ?? [])
    .filter((q, i, all) => all.indexOf(q) === i)
    .slice(0, 6);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-6 text-center">
      <h1 className="animate-fade-up text-xl font-semibold leading-relaxed text-[var(--primary)] sm:text-2xl">
        ถามดวงได้เลย
      </h1>
      <p className="animate-fade-up stagger-1 mt-3 text-sm leading-relaxed text-[var(--muted)]">
        {plan === "PRO"
          ? "การงาน การเงิน ความรัก สุขภาพ ถามในแชทนี้ได้ทั้งหมด — ระบบดึงดวงจรปัจจุบันให้อัตโนมัติ"
          : "ถามเรื่องตัวตนและการงานได้เลย หากข้อความเป็นหมวดอื่น ระบบจะชวนอัปเกรด — ดวงจรดึงให้อัตโนมัติ"}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {suggestions.map((q, i) => (
            <button
              key={q}
              type="button"
              disabled={emailGate}
              onClick={() => {
                if (emailGate) return;
                onPick(q);
              }}
              className={`animate-fade-up stagger-${Math.min(i + 2, 6)} press-scale rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-xs text-[var(--muted)] transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0`}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingContextBar({
  mode,
  category,
  detail,
}: {
  mode: "natal" | "transit" | "reference";
  category?: string;
  detail?: string | null;
}) {
  const label =
    mode === "transit"
      ? "กำลังถามดวงจร"
      : mode === "reference"
        ? "กำลังดูพื้นดวง"
        : "กำลังอ่านพื้นดวง";
  const hint =
    mode === "transit"
      ? "ถามต่อได้ในหมวดนี้"
      : mode === "reference"
        ? "ข้อมูลพื้นดวงที่ระบบใช้"
        : "สรุปอัตโนมัติ ไม่หัก usage";

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 md:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-[var(--foreground)]">
          <span className="font-semibold text-[var(--primary)]">{label}</span>
          {category ? <span> · {category}</span> : null}
          {detail ? (
            <span className="hidden text-[var(--muted)] sm:inline"> · {detail}</span>
          ) : null}
        </p>
        <span className="hidden shrink-0 text-[11px] text-[var(--muted-2)] sm:inline">{hint}</span>
      </div>
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
      <p className="mb-2 rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-medium text-[var(--primary)]">
        สิทธิ์แพ็กเกจ Pro
      </p>
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        หมวด{category ? `“${category}”` : "นี้"}ยังไม่รวมใน Free
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        แพ็กทดลองใช้ได้หมวด「ตัวตน」กับ「การงาน」เท่านั้น · หมวดอื่นและโหมดดวงจรปลดล็อกเมื่ออัปเกรด Pro
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <a
          href="/dashboard?cat=self"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
        >
          ไปหมวดตัวตน
        </a>
        <a
          href="/account"
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
        >
          ดูแพ็กเกจ Pro
        </a>
      </div>
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
        <span className="text-xs font-medium text-[var(--primary)]">{label}</span>
      </div>
      <p className="pl-0 text-[11px] tabular-nums text-[var(--muted-2)]">
        ใช้เวลาไปแล้ว{" "}
        <span className="font-medium text-[var(--muted)]">
          {formatElapsed(elapsed)}
        </span>
        {elapsed >= 20 ? (
          <span className="ml-1 opacity-80">· นานกว่าปกติ แต่ยังทำงานอยู่</span>
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
    usageRemainingPercent?: number;
    plan?: "FREE" | "PRO";
    needsEmailVerification?: boolean;
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
    usageRemainingPercent,
    plan = "FREE",
    needsEmailVerification = false,
    answerMode,
    onAnswerModeChange,
  },
  ref,
) {
  // Touch devices have no Shift+Enter — that desktop hint only confused phone
  // users, who send with the keyboard's own return/newline keys.
  const coarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    () => false,
  );

  const remaining = usageRemainingPercent ?? 0;
  const lowUsage = remaining <= 20;
  const usageExhausted = remaining <= 0;
  const emailGate = needsEmailVerification && plan === "FREE";
  const placeholder = !aiEnabled
    ? "เปิดให้ใช้งานในเฟสถัดไป"
    : emailGate
      ? "ยืนยันอีเมลก่อนใช้ usage ทดลอง"
      : categoryLocked
        ? "หมวดนี้ใช้ได้ใน Pro — เลือกตัวตน/การงาน หรืออัปเกรด"
        : coarsePointer
          ? "สอบถามเราได้เลย…"
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
      {emailGate ? (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--foreground)]">
          <span>
            ยืนยันอีเมลก่อนใช้ usage ทดลอง — เช็กกล่องจดหมาย หรือกดส่งใหม่ที่แถบด้านบน
          </span>
        </div>
      ) : null}
      {lowUsage && !categoryLocked && !emailGate ? (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--foreground)]">
          <span>
            {usageExhausted
              ? "usage หมดแล้ว — เติม usage หรือเริ่มรอบแพ็กเกจใหม่เพื่อถามต่อ"
              : `เหลือ usage ${remaining}% — โหมด「กระชับ」จะใช้ได้นานกว่า`}
          </span>
          <a
            href="/account"
            className="shrink-0 font-semibold text-[var(--primary)] underline"
          >
            ดูแพ็กเกจ
          </a>
        </div>
      ) : null}
      <div className="mx-auto mb-1 flex max-w-3xl items-center justify-between gap-2">
        <div
          className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-[11px]"
          role="group"
          aria-label="โหมดคำตอบ"
        >
          <button
            type="button"
            onClick={() => onAnswerModeChange("brief")}
            disabled={!aiEnabled || emailGate}
            aria-pressed={answerMode === "brief"}
            className={`min-h-9 rounded-md px-3 py-1.5 transition ${
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
            disabled={
              !aiEnabled ||
              emailGate ||
              usageExhausted
            }
            title={
              usageExhausted
                ? "usage หมดแล้ว"
                : undefined
            }
            aria-pressed={answerMode === "detailed"}
            className={`min-h-9 rounded-md px-3 py-1.5 transition ${
              answerMode === "detailed"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            ละเอียด
          </button>
        </div>
        {aiEnabled ? (
          <p className="text-[11px] text-[var(--muted)]">
            เหลือ <span className="font-semibold tabular-nums text-[var(--foreground)]">{remaining}%</span>
          </p>
        ) : null}
      </div>
      <p className="mx-auto mb-2 max-w-3xl text-[10px] text-[var(--muted)]">
        กระชับ ≈ สั้น เร็ว · ละเอียด ≈ ยาวขึ้น ใช้โควตามากกว่า
      </p>
      <div className="mx-auto flex max-w-3xl items-end gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 transition-colors duration-200 focus-within:border-[var(--primary)]/70 focus-within:ring-1 focus-within:ring-[var(--primary)]/30">
        <textarea
          ref={ref}
          value={value}
          rows={1}
          aria-label="ข้อความคำถาม"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!emailGate && !disabled) onSend();
            }
          }}
          disabled={!aiEnabled || emailGate || disabled || usageExhausted}
          placeholder={placeholder}
          className="max-h-[200px] min-h-6 w-full resize-none bg-transparent text-base font-medium leading-6 text-[var(--foreground)] antialiased outline-none placeholder:font-normal placeholder:text-[var(--muted)] disabled:cursor-not-allowed md:text-[15px]"
        />
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
            disabled={
              disabled ||
              !aiEnabled ||
              categoryLocked ||
              emailGate ||
              usageExhausted ||
              !value.trim()
            }
            className="press-scale flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--primary)] transition hover:bg-[var(--background)] hover:text-[var(--primary-hover)] disabled:opacity-40"
            aria-label="ส่ง"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.4 20.4l17.6-8.4a.9.9 0 0 0 0-1.6L3.4 2A.7.7 0 0 0 2.4 3l2.3 6.9c.1.4.4.6.8.7l7.3 1c.2 0 .2.3 0 .4l-7.3 1c-.4 0-.7.3-.8.7L2.4 21a.7.7 0 0 0 1 .9z" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--muted-2)]">
        Horasard อาจให้ข้อมูลที่ไม่ถูกต้องเสมอไป โปรดใช้วิจารณญาณ ·{" "}
        <a href="/disclaimer" className="underline hover:text-[var(--muted)]">
          ข้อจำกัดความรับผิด
        </a>
      </p>
      <ChatDisclaimerNotice />
    </div>
  );
});

function subscribeNoop() {
  return () => {};
}

function readChatDisclaimerVisible(): boolean {
  try {
    return sessionStorage.getItem("horasard:chatDisclaimerDismissed") !== "1";
  } catch {
    return true;
  }
}

function ChatDisclaimerNotice() {
  const storedVisible = useSyncExternalStore(
    subscribeNoop,
    readChatDisclaimerVisible,
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  if (!storedVisible || dismissed) return null;

  return (
    <div className="mx-auto mt-2 flex max-w-3xl items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--muted)]">
      <p>
        คำทำนายเพื่อความบันเทิงและเป็นแนวทางเท่านั้น ไม่ใช่คำแนะนำทางการเงิน กฎหมาย
        หรือการแพทย์ —{" "}
        <a href="/disclaimer" className="text-[var(--primary)] underline">
          อ่านเพิ่ม
        </a>
      </p>
      <button
        type="button"
        className="shrink-0 text-[var(--muted-2)] hover:text-[var(--foreground)]"
        aria-label="ปิดคำเตือน"
        onClick={() => {
          try {
            sessionStorage.setItem("horasard:chatDisclaimerDismissed", "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
