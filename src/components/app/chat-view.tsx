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

import { ExpandableRasiWheel } from "./expandable-rasi-wheel";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { ChatUsageBar } from "./chat-usage-bar";
import { CopyMessageButton } from "./copy-message-button";
import { MessageActions } from "./message-actions";
import { NatalChartBanner } from "./natal-chart-banner";
import { SmoothStreamMarkdown } from "./smooth-stream-markdown";
import { useMyUsage } from "@/hooks/use-my-usage";
import type { ChartJson } from "@/types/chart";
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
};
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
  setters.setErrorText(
    pendingChatMsg ??
      localizeApiError(message, ERROR_MESSAGES[code] ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"),
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
  const [state, setState] = useState<ChatState>("idle");
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase | null>(
    null,
  );
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

  function setMessageFeedback(messageId: string, value: FeedbackValue) {
    setFeedbackById((prev) => {
      const next = { ...prev, [messageId]: value };
      window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Load past thread when ?thread= is set — soft switch from cache first.
  useEffect(() => {
    if (!threadId) return;
    if (sendingThreadRef.current === threadId) return;
    let alive = true;

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
      setMessages(payload.messages as Message[]);
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

    let alive = true;
    const pollStarted = Date.now();
    const tick = async () => {
      try {
        if (Date.now() - pollStarted > 120_000) {
          if (!alive) return;
          setState("error");
          setErrorCode("AI_TIMEOUT");
          setErrorText(
            "ใช้เวลานานเกินไป — ลองถามใหม่อีกครั้ง (ยังไม่หักเครดิตถ้ายังไม่มีคำตอบ)",
          );
          return;
        }
        const res = await fetch(`/api/conversations/${threadId}/poll`);
        const json = await parseApiJson(res);
        if (!alive || !res.ok || !json?.ok) return;
        const poll = json.data as {
          hasPending: boolean;
          messages: Message[] | null;
        };

        if (poll.hasPending) {
          setState("processing");
          return;
        }

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

    const id = window.setInterval(() => {
      void tick();
    }, 2000);
    void tick();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [threadId, pendingAssistantIds, refreshLight]);

  // Reset the thread when the selected category changes (new chat).
  useEffect(() => {
    if (threadId) return;
    if (streamTimer.current) window.clearInterval(streamTimer.current);
    conversationIdRef.current = null;
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

    const editUserMessageId = options.editUserMessageId ?? editingMessageId ?? undefined;
    if (editUserMessageId) {
      const idx = messages.findIndex((m) => m.id === editUserMessageId);
      if (idx >= 0) {
        setMessages((prev) => [
          ...prev.slice(0, idx),
          { ...prev[idx], content },
        ]);
      }
      setEditingMessageId(null);
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
    if (!isRetry && !isRegenerate && !editUserMessageId) {
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      window.localStorage.removeItem(DRAFT_KEY);
    }

    setErrorText(null);
    setErrorCode(null);
    setThinkingPhase(null);
    setState("processing");
    processingStartedAtRef.current = Date.now();
    lastDeltaAtRef.current = null;

    const idempotencyKey = options.retryKey ?? crypto.randomUUID();
    if (!isRetry) {
      setPendingRetry({ question: content, idempotencyKey });
    }

    const assistantId = `stream-${idempotencyKey}`;
    // Hoisted so the catch can keep whatever streamed before a stop/disconnect.
    let assembled = "";
    let activeConversationId: string | null = null;
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
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setState("idle");
        processingStartedAtRef.current = null;
        return;
      }

      // Claim it before the URL changes, so the loader never races this send.
      sendingThreadRef.current = activeConversationId;

      // The user can switch threads or start a new chat mid-answer. This stream
      // belongs to the thread it started on; painting its deltas into whatever
      // happens to be on screen would graft one conversation onto another. The
      // answer still lands — the server finalizes it and it is there on return.
      const ownsView = () => conversationIdRef.current === activeConversationId;

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
        // "the page refreshed while it was typing" flash. replaceState still
        // syncs useSearchParams, so threadId lands without any of that.
        window.history.replaceState(
          window.history.state,
          "",
          `/dashboard?thread=${activeConversationId}&cat=${syncCat}`,
        );
        window.dispatchEvent(
          new CustomEvent("horasard:soft-nav", {
            detail: { href: `/dashboard?thread=${activeConversationId}&cat=${syncCat}` },
          }),
        );
        conversationIdRef.current = activeConversationId;
      }

      // Placeholder already added above — ensure idempotency key is wired for stop.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, status: "PENDING" as const, idempotencyKey }
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
            editUserMessageId,
            regenerateAssistantMessageId: options.regenerateAssistantMessageId,
            answerMode,
          }),
          signal: abort.signal,
        },
      );

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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotDelta = false;
      let finished = false;

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

          if (event.type === "status" && event.phase) {
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
            lastDeltaAtRef.current = Date.now();
            assembled += event.text;
            assembledRef.current = assembled;
            if (!ownsView()) continue;
            setThinkingPhase(null);
            setState("streaming");
            // Flush to React every chunk so the typewriter can run frames
            // between network reads (avoids one giant paint at the end).
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: assembled,
                      status: "PENDING",
                      idempotencyKey,
                    }
                  : m,
              ),
            );
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
          } else if (event.type === "done") {
            finished = true;
            if (!ownsView()) continue;
            const reading = event.reading;
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
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: finalText,
                      modelId: reading?.modelId ?? DEFAULTS.defaultGeminiModelId,
                      status: "SUCCESS",
                      chartSnapshot: reading?.chartSnapshot ?? null,
                      transitSnapshot: reading?.transitSnapshot ?? null,
                      summaryLine,
                      followUps,
                    }
                  : m,
              ),
            );
            setState("idle");
            setErrorText(null);
            setErrorCode(null);
            setPendingRetry(null);
            processingStartedAtRef.current = null;
            lastDeltaAtRef.current = null;
            void refreshLight();
            void usageRefreshRef.current?.();
          } else if (event.type === "error") {
            finished = true;
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
      if (!finished) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: assembled || m.content,
                  status: "PENDING" as const,
                  idempotencyKey,
                }
              : m,
          ),
        );
        setState("processing");
      }
    } catch (err) {
      // User pressed Stop — UI already settled in stopStreaming().
      if (abort.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        if (explicitStopRef.current) return;
        // Timed out waiting for SSE — server may still be generating; poll it.
        const convId = activeConversationId ?? conversationIdRef.current;
        if (convId) {
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
          setState("processing");
          return;
        }
        return;
      }
      // The connection dropped, but the server keeps generating and finalizes
      // the message, so fall back to the PENDING poll rather than erroring out
      // over an answer that is still on its way.
      if (assembled) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: assembled,
                  status: "PENDING",
                  idempotencyKey,
                }
              : m,
          ),
        );
        setState("processing");
        return;
      }
      setErrorCode("NETWORK");
      setErrorText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setState("error");
    } finally {
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

  function regenerateAssistant(assistantId: string) {
    if (isBusy) return;
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx <= 0) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== "user") return;
    setMessages((prev) => prev.slice(0, idx));
    setErrorText(null);
    setErrorCode(null);
    void send(userMsg.content, { regenerateAssistantMessageId: assistantId });
  }

  function retryFailedAssistant(assistantId: string) {
    if (isBusy) return;
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx <= 0) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== "user") return;
    setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    void send(userMsg.content, { regenerateAssistantMessageId: assistantId });
  }

  function prefillFromChart(prompt: string) {
    setEditingMessageId(null);
    setInput(prompt);
    window.localStorage.setItem(DRAFT_KEY, prompt);
    composerRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-2">
            {messages.map((m, idx) => {
              const isStreamingTurn =
                (state === "streaming" || state === "processing") &&
                m.role === "assistant" &&
                idx === messages.length - 1 &&
                m.status === "PENDING";
              return m.role === "user" ? (
                <div key={m.id} className="animate-msg-in group flex flex-col items-end">
                  <div
                    className={`max-w-[min(85%,42rem)] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-3 text-[15px] leading-6 text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--border)] ${
                      editingMessageId === m.id
                        ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40"
                        : "bg-[var(--surface-3)]"
                    }`}
                  >
                    {m.content}
                  </div>
                  {!isBusy && !m.id.startsWith("stream-") ? (
                    <MessageActions
                      role="user"
                      messageId={m.id}
                      content={m.content}
                      canEdit
                      onEdit={() => startEditMessage(m.id, m.content)}
                    />
                  ) : null}
                </div>
              ) : (
                <div key={m.id} className="animate-msg-in group flex gap-3 sm:gap-4">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/35 bg-[var(--surface-2)] text-[var(--primary)]"
                    aria-hidden
                  >
                    <SparkleIcon />
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
                      <ThinkingIndicator phase={thinkingPhase} />
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
                        {!isBusy && !m.id.startsWith("stream-") ? (
                          <MessageActions
                            role="assistant"
                            messageId={m.id}
                            content={m.content}
                            canRegenerate={m.status !== "PENDING"}
                            failed={m.status === "FAILED" || m.status === "TIMEOUT"}
                            onRegenerate={() => regenerateAssistant(m.id)}
                            onRetry={
                              m.status === "FAILED" || m.status === "TIMEOUT"
                                ? () => retryFailedAssistant(m.id)
                                : undefined
                            }
                            feedback={feedbackById[m.id] ?? null}
                            onFeedback={(value) => setMessageFeedback(m.id, value)}
                          />
                        ) : (
                          <CopyMessageButton text={m.content} />
                        )}
                        {m.modelId && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-[var(--muted-2)]">
                            ตอบโดย {modelLabel(m.modelId)}
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
              ) && <ThinkingIndicator phase={thinkingPhase} />}
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

function ThinkingIndicator({ phase }: { phase?: ThinkingPhase | null }) {
  const [elapsed, setElapsed] = useState(0);
  const label =
    phase && THINKING_PHASE_LABEL[phase]
      ? THINKING_PHASE_LABEL[phase]
      : "กำลังเพ่งดวงดาว…";

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

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

function SparkleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.1 6.4L20.5 10l-6.4 2.1L12 18.5 9.9 12.1 3.5 10l6.4-1.6L12 2z" />
    </svg>
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
          className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none disabled:cursor-not-allowed"
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
