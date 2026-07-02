"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { findCategory } from "./nav-data";

type Message = { id: string; role: "user" | "assistant"; content: string };
type ChatState = "idle" | "processing" | "locked" | "no-quota" | "error";

const EMPTY_HEADING = "ในทางโหราศาสตร์ไทย ดวงดาวเป็นเพียงเครื่องมือ\nบอกจังหวะชีวิตเพื่อให้เราเตรียมพร้อม";
const EMPTY_PARAGRAPH =
  "การทำนายไม่ใช่การกำหนดชะตา แต่เป็นแนวทางให้เรารู้จังหวะ เพื่อวางแผนและลงมือทำอย่างมีสติ สิ่งที่สำคัญที่สุดคือการกระทำและจิตใจของเราเอง ไม่ว่าดวงจะบอกอะไร เราก็ยังเป็นผู้เลือกทางเดินของตัวเองได้เสมอ";

/** Mock assistant reply used until the chat API exists. */
const MOCK_REPLY =
  "จากดวงการงานของคุณ ช่วงนี้ถึงช่วงปลายปี เรือนวินาศ (การงาน) อยู่ในราศีกรกฎ มีดาวอาทิตย์ (๑) พุธ (๔) และพฤหัสบดี (๕) เรียงกัน\n\nดาวพฤหัส (๕) อยู่ในตำแหน่งมหาอุจจ์ แสดงว่าเมื่อโอกาสด้านการงาน ดาวอาทิตย์ (๑) อยู่ในตำแหน่งมหาจักร ต้องใช้ความพยายาม แต่ผลลัพธ์ดี\n\nช่วงนี้เหมาะกับการวางแผนระยะยาวและสร้างความสัมพันธ์ในที่ทำงาน หากมีโอกาสเปลี่ยนงาน ควรพิจารณาอย่างรอบคอบก่อนตัดสินใจ";

export function ChatView() {
  const searchParams = useSearchParams();
  const catSlug = searchParams.get("cat");
  const category = findCategory(catSlug);
  const locked = category?.tier === "PRO";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ChatState>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the thread when the selected category changes.
  useEffect(() => {
    setMessages([]);
    setState(locked ? "locked" : "idle");
    setInput("");
  }, [catSlug, locked]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, state]);

  function send(text: string) {
    const content = text.trim();
    if (!content || state === "processing") return;
    if (locked) {
      setState("locked");
      return;
    }

    // TODO(backend): POST /api/conversations/:id/messages with a stable
    // Idempotency-Key (reuse the same key on retry so credit isn't double-charged).
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setState("processing");

    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: MOCK_REPLY },
      ]);
      setState("idle");
    }, 1200);
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
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-[var(--surface-3)] px-4 py-2.5 text-sm text-[var(--foreground)]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="max-w-[85%] whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                  {m.content}
                </div>
              ),
            )}
            {state === "processing" && <TypingDots />}
            {state === "error" && (
              <p className="text-sm text-[var(--danger)]">
                เกิดข้อผิดพลาด ลองใหม่อีกครั้ง
              </p>
            )}
          </div>
        )}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        disabled={state === "processing"}
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
      <h1 className="whitespace-pre-line text-xl font-semibold leading-relaxed text-[var(--primary)] sm:text-2xl">
        {EMPTY_HEADING}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{EMPTY_PARAGRAPH}</p>

      {category && (
        <p className="mt-6 text-xs text-[var(--muted-2)]">หัวข้อ: {category}</p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
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

function TypingDots() {
  return (
    <div className="flex items-center gap-1 text-[var(--muted-2)]">
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
    </div>
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
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-40"
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
