"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULTS } from "@/config/constants";
import { FEATURES } from "@/config/features";
import {
  isCategoryLocked,
  useAppData,
  useCategory,
} from "./app-data-provider";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
};
type ChatState =
  | "idle"
  | "processing"
  | "streaming"
  | "locked"
  | "no-quota"
  | "error";

/** Map API error codes (lib/errors.ts) to friendly Thai messages. */
const ERROR_MESSAGES: Record<string, string> = {
  NO_QUOTA: "เครดิตหมดแล้ว เติมเครดิตหรืออัปเกรดเป็น Pro เพื่อถามต่อ",
  CATEGORY_LOCKED: "หมวดนี้สำหรับสมาชิก Pro",
  CHAT_REQUIRES_PRO: "ต้องอัปเกรดเป็น Pro ก่อนจึงจะสนทนากับ AI ได้",
  AI_TIMEOUT: "หมอดูใช้เวลานานเกินไป ลองถามใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
  AI_PROVIDER_ERROR: "ระบบทำนายขัดข้องชั่วคราว ลองใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
  VALIDATION: "กรุณากรอกข้อมูลวันเกิดก่อนเริ่มดูดวง",
  RATE_LIMITED: "ถามถี่เกินไป รอสักครู่แล้วลองใหม่",
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

export function ChatView() {
  const searchParams = useSearchParams();
  const catSlug = searchParams.get("cat");
  const threadId = searchParams.get("thread");
  const { user, refresh } = useAppData();
  const category = useCategory(catSlug);
  const locked = isCategoryLocked(category, user?.plan ?? "FREE");
  const chatBlocked = FEATURES.aiChat && Boolean(user && !user.canChat);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ChatState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamTimer = useRef<number | null>(null);

  // Load past thread when ?thread= is set.
  useEffect(() => {
    if (!threadId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingThread(true);
    fetch(`/api/conversations/${threadId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json?.ok) return;
        setMessages(json.data.messages);
        setState("idle");
        setErrorText(null);
        setPendingRetry(null);
      })
      .catch(() => {})
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setState(locked ? "locked" : "idle");
    setInput("");
    setErrorText(null);
    setPendingRetry(null);
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

  function streamReply(full: string, modelId: string) {
    const id = crypto.randomUUID();
    setMessages((m) => [...m, { id, role: "assistant", content: "", modelId }]);
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
      }
    }, 24);
  }

  async function send(text: string, retryKey?: string) {
    const content = text.trim();
    if (!content || state === "processing" || state === "streaming") return;

    if (!FEATURES.aiChat) {
      setErrorText(ERROR_MESSAGES.FEATURE_DISABLED);
      setState("error");
      return;
    }
    if (locked) {
      setState("locked");
      return;
    }
    if (chatBlocked) {
      setErrorText(ERROR_MESSAGES.CHAT_REQUIRES_PRO);
      setState("error");
      return;
    }
    if (!catSlug) {
      setErrorText("เลือกหมวดจากแถบข้างก่อนเริ่มดูดวง");
      setState("error");
      return;
    }

    const isRetry = Boolean(retryKey);
    if (!isRetry) {
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setInput("");
    }

    setErrorText(null);
    setState("processing");

    const idempotencyKey = retryKey ?? crypto.randomUUID();
    if (!isRetry) {
      setPendingRetry({ question: content, idempotencyKey });
    }

    try {
      const res = await fetch("/api/horoscope/readings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ categorySlug: catSlug, question: content }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const code: string = json?.error?.code ?? "INTERNAL";
        if (code === "CATEGORY_LOCKED") {
          setState("locked");
          return;
        }
        if (code === "CHAT_REQUIRES_PRO") {
          setErrorText(ERROR_MESSAGES.CHAT_REQUIRES_PRO);
          setState("error");
          return;
        }
        setErrorText(
          ERROR_MESSAGES[code] ??
            json?.error?.message ??
            "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
        );
        setState(
          code === "NO_QUOTA"
            ? "no-quota"
            : code === "USER_DISABLED"
              ? "error"
              : "error",
        );
        return;
      }

      setPendingRetry(null);
      const reading = json.data as { responseText: string; modelId: string | null };
      streamReply(
        reading.responseText,
        reading.modelId ?? DEFAULTS.defaultGeminiModelId,
      );
    } catch {
      setErrorText("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setState("error");
    }
  }

  const showUpgrade =
    messages.length === 0 && chatBlocked && !locked && !loadingThread && !threadId;
  const showEmpty =
    messages.length === 0 && !chatBlocked && state !== "locked" && !loadingThread && !threadId;

  return (
    <div className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 pt-14 md:px-8 md:pt-6">
        {!FEATURES.aiChat && (
          <div className="animate-fade-in mx-auto mb-6 max-w-3xl rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-2)] px-4 py-3 text-center text-xs text-[var(--muted)]">
            ตัวอย่างระบบ (เฟสนี้) — ระบบดูดวงด้วย AI จะเปิดให้ใช้งานจริงในเฟสถัดไป
          </div>
        )}
        {loadingThread ? (
          <p className="text-center text-sm text-[var(--muted)]">กำลังโหลดประวัติ…</p>
        ) : showUpgrade ? (
          <UpgradeProState category={category?.label} />
        ) : showEmpty ? (
          <EmptyState
            category={category?.label}
            suggestions={category?.suggestedQuestions ?? []}
            onPick={send}
          />
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
                </div>
              ),
            )}
            {state === "processing" && <ThinkingIndicator />}
            {(state === "error" || state === "no-quota") && (
              <ErrorBanner
                state={state}
                errorText={errorText}
                onRetry={
                  pendingRetry
                    ? () => send(pendingRetry.question, pendingRetry.idempotencyKey)
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        disabled={
          state === "processing" || state === "streaming" || locked || chatBlocked
        }
        aiEnabled={FEATURES.aiChat && !locked && !chatBlocked}
      />
    </div>
  );
}

function ErrorBanner({
  state,
  errorText,
  onRetry,
}: {
  state: "error" | "no-quota";
  errorText: string | null;
  onRetry?: () => void;
}) {
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
        {state === "no-quota" && (
          <a
            href="/account"
            className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            ดูแพ็กเกจ / เติมเครดิต
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
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-10 text-center">
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

function UpgradeProState({ category }: { category?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center pt-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--primary)]/40 text-[var(--primary)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        สนทนากับ AI สำหรับสมาชิก Pro
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {category
          ? `หมวด“${category}”ดูได้ในบัญชี Free แต่การถาม–ตอบกับ AI ต้องอัปเกรดเป็น Pro`
          : "บัญชี Free ดูหมวดพื้นดวงเดิมได้ แต่การถาม–ตอบกับ AI ต้องอัปเกรดเป็น Pro"}
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  aiEnabled: boolean;
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
        Horasard อาจให้ข้อมูลที่ไม่ถูกต้องเสมอไป โปรดใช้วิจารณญาณ
      </p>
    </div>
  );
}
