"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULTS } from "@/config/constants";
import { findCategory } from "./nav-data";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Model that produced this reply (assistant only) — from AIProviderConfig. */
  modelId?: string;
};
type ChatState = "idle" | "processing" | "streaming" | "locked" | "no-quota" | "error";

/** Map API error codes (lib/errors.ts) to friendly Thai messages. */
const ERROR_MESSAGES: Record<string, string> = {
  NO_QUOTA: "เครดิตหมดแล้ว เติมเครดิตหรืออัปเกรดเป็น Pro เพื่อถามต่อ",
  CATEGORY_LOCKED: "หมวดนี้สำหรับสมาชิก Pro",
  AI_TIMEOUT: "หมอดูใช้เวลานานเกินไป ลองถามใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
  AI_PROVIDER_ERROR: "ระบบทำนายขัดข้องชั่วคราว ลองใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
  VALIDATION: "กรุณากรอกข้อมูลวันเกิดก่อนเริ่มดูดวง",
  RATE_LIMITED: "ถามถี่เกินไป รอสักครู่แล้วลองใหม่",
  UNAUTHENTICATED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
};

/** Pretty label for a model id, e.g. "gemini-2.5-flash" → "Gemini 2.5 Flash". */
function modelLabel(modelId: string): string {
  return modelId
    .split("-")
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const EMPTY_HEADING = "ในทางโหราศาสตร์ไทย ดวงดาวเป็นเพียงเครื่องมือ\nบอกจังหวะชีวิตเพื่อให้เราเตรียมพร้อม";
const EMPTY_PARAGRAPH =
  "การทำนายไม่ใช่การกำหนดชะตา แต่เป็นแนวทางให้เรารู้จังหวะ เพื่อวางแผนและลงมือทำอย่างมีสติ สิ่งที่สำคัญที่สุดคือการกระทำและจิตใจของเราเอง ไม่ว่าดวงจะบอกอะไร เราก็ยังเป็นผู้เลือกทางเดินของตัวเองได้เสมอ";

export function ChatView() {
  const searchParams = useSearchParams();
  const catSlug = searchParams.get("cat");
  const category = findCategory(catSlug);
  const locked = category?.tier === "PRO";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ChatState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamTimer = useRef<number | null>(null);

  // Reset the thread when the selected category changes.
  useEffect(() => {
    if (streamTimer.current) window.clearInterval(streamTimer.current);
    setMessages([]);
    setState(locked ? "locked" : "idle");
    setInput("");
    setErrorText(null);
  }, [catSlug, locked]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, state]);

  useEffect(() => {
    return () => {
      if (streamTimer.current) window.clearInterval(streamTimer.current);
    };
  }, []);

  /** Reveal the reply progressively (typewriter) like ChatGPT streaming. */
  function streamReply(full: string, modelId: string) {
    const id = crypto.randomUUID();
    setMessages((m) => [...m, { id, role: "assistant", content: "", modelId }]);
    setState("streaming");

    let i = 0;
    streamTimer.current = window.setInterval(() => {
      // Reveal a few characters per tick for a natural pace.
      i = Math.min(full.length, i + 3);
      const slice = full.slice(0, i);
      setMessages((m) =>
        m.map((msg) => (msg.id === id ? { ...msg, content: slice } : msg)),
      );
      if (i >= full.length) {
        if (streamTimer.current) window.clearInterval(streamTimer.current);
        streamTimer.current = null;
        setState("idle");
      }
    }, 24);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || state === "processing" || state === "streaming") return;
    if (locked) {
      setState("locked");
      return;
    }
    if (!catSlug) {
      setErrorText("เลือกหมวดจากแถบข้างก่อนเริ่มดูดวง");
      setState("error");
      return;
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setErrorText(null);
    setState("processing");

    // Stable per-request key: a retry of the SAME question reuses the reading
    // on the server instead of charging credit twice.
    const idempotencyKey = crypto.randomUUID();

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
        setErrorText(
          ERROR_MESSAGES[code] ?? json?.error?.message ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
        );
        setState(code === "NO_QUOTA" ? "no-quota" : "error");
        return;
      }

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

  const showEmpty = messages.length === 0 && state !== "locked";

  return (
    <div className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {showEmpty ? (
          <EmptyState
            category={category?.label}
            suggestions={category?.suggestedQuestions ?? []}
            onPick={send}
          />
        ) : state === "locked" ? (
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
                  {m.modelId && !(state === "streaming" && idx === messages.length - 1) && (
                    <p className="animate-fade-in mt-2 flex items-center gap-1.5 text-[10px] text-[var(--muted-2)]">
                      <SparkleIcon />
                      ตอบโดย {modelLabel(m.modelId)}
                    </p>
                  )}
                </div>
              ),
            )}
            {state === "processing" && <ThinkingIndicator />}
            {state === "error" && (
              <p className="animate-fade-in text-sm text-[var(--danger)]">
                {errorText ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"}
              </p>
            )}
            {state === "no-quota" && (
              <div className="animate-fade-in flex flex-col items-start gap-2">
                <p className="text-sm text-[var(--danger)]">
                  {errorText ?? "เครดิตหมดแล้ว"}
                </p>
                <a
                  href="/account"
                  className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
                >
                  ดูแพ็กเกจ / เติมเครดิต
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        disabled={state === "processing" || state === "streaming"}
      />
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

/** AI "thinking" indicator — gold star-dots rising in a wave + shimmer label. */
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <div className="px-4 pb-6 md:px-8">
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 transition-shadow duration-300 focus-within:border-[var(--primary)]/50 focus-within:shadow-[0_0_0_3px_var(--ring)]">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="สอบถามเราได้เลย"
          className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none"
        />
        {/* Phone/Voice = Phase 2 → shown disabled per design. */}
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
          disabled={disabled || !value.trim()}
          className="press-scale flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] hover:shadow-[0_0_12px_var(--ring)] disabled:opacity-40"
          aria-label="ส่ง"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-[var(--muted-2)]">
        Horasard อาจให้ข้อมูลที่ไม่ถูกต้องเสมอไป โปรดใช้วิจารณญาณ
      </p>
    </div>
  );
}
