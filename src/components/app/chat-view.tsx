"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULTS } from "@/config/constants";
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
import { NatalChartBanner } from "./natal-chart-banner";
import type { ChartJson } from "@/types/chart";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  chartSnapshot?: ChartJson | null;
  transitSnapshot?: ChartJson | null;
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

async function parseApiJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
      message?.trim() ??
      ERROR_MESSAGES[code] ??
      "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const catSlug = searchParams.get("cat");
  const threadId = searchParams.get("thread");
  const { user, refresh, pendingPayment } = useAppData();
  const category = useCategory(catSlug);
  const locked = isCategoryLocked(category, user?.plan ?? "FREE");
  const hasPendingPayment = Boolean(pendingPayment);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ChatState>("idle");
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamTimer = useRef<number | null>(null);
  const conversationIdRef = useRef<string | null>(threadId);
  const usageRefreshRef = useRef<(() => void) | null>(null);
  const registerUsageRefresh = useCallback((fn: () => void) => {
    usageRefreshRef.current = fn;
  }, []);

  useEffect(() => {
    conversationIdRef.current = threadId;
  }, [threadId]);

  // Load past thread when ?thread= is set.
  useEffect(() => {
    if (!threadId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingThread(true);
    setThreadLoadError(null);
    fetch(`/api/conversations/${threadId}`)
      .then((r) => parseApiJson(r).then((json) => ({ res: r, json })))
      .then(({ res, json }) => {
        if (!alive) return;
        if (!res.ok || !json?.ok) {
          setThreadLoadError(
            json?.error?.message ?? "โหลดประวัติการสนทนาไม่สำเร็จ",
          );
          setMessages([]);
          setState("error");
          return;
        }
        setMessages(json.data.messages);
        setThreadCategorySlug(json.data.categorySlug ?? null);
        setThreadMode(json.data.mode === "TRANSIT" ? "TRANSIT" : "NATAL");
        if (json.data.mode === "TRANSIT" && json.data.transitDate) {
          const d = new Date(json.data.transitDate);
          const dateLabel = Number.isNaN(d.getTime())
            ? null
            : d.toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              });
          const time = json.data.transitTime
            ? ` · ${json.data.transitTime}`
            : "";
          setThreadTransitLabel(dateLabel ? `${dateLabel}${time}` : null);
        } else {
          setThreadTransitLabel(null);
        }
        setState("idle");
        setErrorText(null);
        setErrorCode(null);
        setPendingRetry(null);
      })
      .catch(() => {
        if (!alive) return;
        setThreadLoadError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        setState("error");
      })
      .finally(() => {
        if (alive) setLoadingThread(false);
      });
    return () => {
      alive = false;
    };
  }, [threadId]);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, state]);

  useEffect(() => {
    return () => {
      if (streamTimer.current) window.clearInterval(streamTimer.current);
    };
  }, []);

  function streamReply(
    full: string,
    modelId: string,
    charts?: { natal?: ChartJson | null; transit?: ChartJson | null },
    onDone?: () => void,
  ) {
    const id = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      {
        id,
        role: "assistant",
        content: "",
        modelId,
        chartSnapshot: charts?.natal ?? null,
        transitSnapshot: charts?.transit ?? null,
      },
    ]);
    setState("streaming");

    let i = 0;
    streamTimer.current = window.setInterval(() => {
      i = Math.min(full.length, i + 3);
      const slice = full.slice(0, i);
      setMessages((m) =>
        m.map((msg) => (msg.id === id ? { ...msg, content: slice } : msg)),
      );
      if (i >= full.length) {
        if (streamTimer.current) window.clearInterval(streamTimer.current);
        streamTimer.current = null;
        setState("idle");
        refresh();
        usageRefreshRef.current?.();
        onDone?.();
      }
    }, 24);
  }

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

  async function send(text: string, retryKey?: string) {
    const content = text.trim();
    if (!content || state === "processing" || state === "streaming") return;

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

    const isRetry = Boolean(retryKey);
    if (!isRetry) {
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setInput("");
    }

    setErrorText(null);
    setErrorCode(null);
    setState("processing");

    const idempotencyKey = retryKey ?? crypto.randomUUID();
    if (!isRetry) {
      setPendingRetry({ question: content, idempotencyKey });
    }

    try {
      const conversationId = categorySlug
        ? await ensureConversation(categorySlug, content, idempotencyKey)
        : (threadId ?? conversationIdRef.current);
      if (!conversationId) return;

      const res = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ content }),
        },
      );
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
        return;
      }

      setErrorCode(null);
      setPendingRetry(null);
      const reading = json.data as {
        responseText: string;
        modelId: string | null;
        chartSnapshot?: ChartJson | null;
        transitSnapshot?: ChartJson | null;
      };
      const syncCat = categorySlug ?? catSlug;
      const shouldSyncUrl = !threadId;
      streamReply(
        reading.responseText,
        reading.modelId ?? DEFAULTS.defaultGeminiModelId,
        {
          natal: reading.chartSnapshot,
          transit: reading.transitSnapshot,
        },
        () => {
          if (shouldSyncUrl && syncCat) {
            router.replace(
              `/dashboard?thread=${conversationId}&cat=${syncCat}`,
              { scroll: false },
            );
          }
        },
      );
    } catch {
      setErrorCode("NETWORK");
      setErrorText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setState("error");
    }
  }

  const showEmpty =
    messages.length === 0 &&
    !locked &&
    state !== "locked" &&
    !loadingThread &&
    !threadId;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatUsageBar registerRefresh={registerUsageRefresh} />
      {threadMode === "TRANSIT" && threadTransitLabel ? (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-xs text-[var(--muted)] md:px-8">
          โหมดดวงจร · {threadTransitLabel}
        </div>
      ) : null}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
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
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m, idx) =>
              m.role === "user" ? (
                <div key={m.id} className="animate-msg-in flex justify-end">
                  <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-[var(--surface-3)] px-4 py-2.5 text-sm text-[var(--foreground)]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="animate-msg-in max-w-[85%]">
                  {(m.chartSnapshot || m.transitSnapshot) && (
                    <div className="mb-3 flex flex-col gap-2">
                      <div className="flex flex-wrap items-start gap-3">
                        {m.chartSnapshot && (
                          <ExpandableRasiWheel
                            chart={m.chartSnapshot}
                            size={96}
                            label="พื้นดวงเดิม"
                          />
                        )}
                        {m.transitSnapshot && (
                          <ExpandableRasiWheel
                            chart={m.transitSnapshot}
                            size={96}
                            label="ดวงจร"
                          />
                        )}
                      </div>
                      {m.chartSnapshot && (
                        <ChartEvidenceTable chart={m.chartSnapshot} mode="natal" />
                      )}
                      {m.transitSnapshot && (
                        <ChartEvidenceTable chart={m.transitSnapshot} mode="transit" />
                      )}
                    </div>
                  )}
                  <div
                    className={`whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)] ${
                      state === "streaming" && idx === messages.length - 1
                        ? "stream-caret"
                        : ""
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.modelId &&
                    !(state === "streaming" && idx === messages.length - 1) && (
                      <p className="animate-fade-in mt-2 flex items-center gap-1.5 text-[10px] text-[var(--muted-2)]">
                        <SparkleIcon />
                        ตอบโดย {modelLabel(m.modelId)}
                      </p>
                    )}
                  {!(state === "streaming" && idx === messages.length - 1) && (
                    <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-2)]">
                      คำทำนายนี้มีไว้เพื่อความบันเทิงและเป็นแนวทางเท่านั้น
                      ไม่ใช่คำแนะนำทางการเงิน กฎหมาย หรือการแพทย์
                    </p>
                  )}
                </div>
              ),
            )}
            {state === "processing" && <ThinkingIndicator />}
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
      </div>

      <div className="shrink-0">
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => send(input)}
          disabled={state === "processing" || state === "streaming" || locked}
          aiEnabled={FEATURES.aiChat && !locked}
          creditCost={DEFAULTS.creditCostPerReading}
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

function ThinkingIndicator() {
  return (
    <div className="animate-fade-in flex items-center gap-3">
      <div className="flex items-end gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="wave-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <span className="shimmer-text text-xs font-medium">กำลังเพ่งดวงดาว…</span>
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

function Composer({
  value,
  onChange,
  onSend,
  disabled,
  aiEnabled,
  creditCost,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  aiEnabled: boolean;
  creditCost?: number;
}) {
  return (
    <div className="px-4 pb-6 md:px-8">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-5 py-3 transition-shadow duration-300 focus-within:border-[var(--primary)]/50 focus-within:shadow-[0_0_0_3px_var(--ring)]">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={!aiEnabled}
          placeholder={aiEnabled ? "สอบถามเราได้เลย" : "เปิดให้ใช้งานในเฟสถัดไป"}
          className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none disabled:cursor-not-allowed"
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
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !aiEnabled || !value.trim()}
          className="press-scale flex shrink-0 items-center justify-center text-[var(--primary)] transition hover:text-[var(--primary-hover)] disabled:opacity-40"
          aria-label="ส่ง"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.4 20.4l17.6-8.4a.9.9 0 0 0 0-1.6L3.4 2A.7.7 0 0 0 2.4 3l2.3 6.9c.1.4.4.6.8.7l7.3 1c.2 0 .2.3 0 .4l-7.3 1c-.4 0-.7.3-.8.7L2.4 21a.7.7 0 0 0 1 .9z" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-[var(--muted-2)]">
        {aiEnabled && creditCost != null && creditCost > 0
          ? `แต่ละคำถามใช้ ${creditCost} เครดิต · `
          : ""}
        Horasard อาจให้ข้อมูลที่ไม่ถูกต้องเสมอไป โปรดใช้วิจารณญาณ
      </p>
    </div>
  );
}
