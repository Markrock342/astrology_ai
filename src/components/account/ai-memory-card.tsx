"use client";

import { useState } from "react";
import type { UserAiMemory } from "@/server/user/ai-memory-service";

type ApiResponse = {
  ok: boolean;
  data?: UserAiMemory;
  error?: { message?: string };
};

export function AiMemoryCard({ initialMemory }: { initialMemory: UserAiMemory }) {
  const [memory, setMemory] = useState(initialMemory);
  const [busy, setBusy] = useState<"toggle" | "reset" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updateEnabled(enabled: boolean) {
    const previous = memory;
    setMemory({ ...memory, enabled });
    setBusy("toggle");
    setMessage(null);
    try {
      const response = await fetch("/api/me/ai-memory", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok || !body.ok || !body.data) {
        setMemory(previous);
        setMessage(body.error?.message ?? "บันทึกการตั้งค่าไม่สำเร็จ");
        return;
      }
      setMemory(body.data);
      setMessage(enabled ? "เปิดความจำกลางแล้ว" : "ปิดความจำกลางแล้ว");
    } catch {
      setMemory(previous);
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function resetMemory() {
    setBusy("reset");
    setMessage(null);
    try {
      const response = await fetch("/api/me/ai-memory", { method: "DELETE" });
      const body = (await response.json()) as ApiResponse;
      if (!response.ok || !body.ok || !body.data) {
        setMessage(body.error?.message ?? "ล้างความจำไม่สำเร็จ");
        return;
      }
      setMemory(body.data);
      setConfirmReset(false);
      setMessage("ล้างบริบทจากแชทเก่าแล้ว ประวัติสนทนายังอยู่ครบ");
    } catch {
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  const hasChatMemory =
    memory.commonTopics.length > 0 || memory.recentQuestions.length > 0;

  return (
    <section
      id="ai-memory"
      aria-labelledby="ai-memory-title"
      className="mt-6 scroll-mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--primary)]">บริบทข้ามบทสนทนา</p>
          <h2 id="ai-memory-title" className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            ความจำของ AI
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted)]">
            ช่วยให้คำตอบทุกหมวดต่อเนื่องกัน โดยจำชื่อเล่น หมวดที่ถามบ่อย และคำถามก่อนหน้า
          </p>
        </div>
        <label className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2">
          <span className="sr-only">เปิดหรือปิดความจำของ AI</span>
          <input
            type="checkbox"
            checked={memory.enabled}
            disabled={busy !== null}
            onChange={(event) => void updateEnabled(event.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 rounded-full border border-[var(--border)] bg-[var(--surface-3)] transition peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] peer-disabled:opacity-60 after:absolute after:left-1 after:top-1 after:h-[18px] after:w-[18px] after:rounded-full after:bg-[var(--foreground)] after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-[var(--primary-foreground)]" />
        </label>
      </div>

      <div className={`mt-5 transition-opacity ${memory.enabled ? "opacity-100" : "opacity-45"}`}>
        {memory.nickname ? (
          <p className="text-sm text-[var(--foreground)]">
            AI จะเรียกคุณว่า <span className="font-semibold text-[var(--primary)]">{memory.nickname}</span>
            <span className="text-[var(--muted-2)]"> · มาจากข้อมูลวันเกิดและยังใช้เรียกคุณเมื่อปิดความจำ</span>
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">ยังไม่มีชื่อเล่นในข้อมูลวันเกิด</p>
        )}

        {memory.commonTopics.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs text-[var(--muted-2)]">หมวดที่คุณถามบ่อย</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {memory.commonTopics.map((topic) => (
                <span
                  key={topic.slug}
                  className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)]"
                >
                  {topic.label} · {topic.count}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <details className="group mt-4" open={hasChatMemory}>
          <summary className="min-h-11 cursor-pointer list-none py-3 text-sm font-medium text-[var(--foreground)] marker:content-none">
            <span className="inline-flex items-center gap-2">
              คำถามล่าสุดที่ใช้เป็นบริบท
              <span aria-hidden className="text-[var(--primary)] transition-transform group-open:rotate-180">⌄</span>
            </span>
          </summary>
          {memory.recentQuestions.length > 0 ? (
            <ol className="grid gap-3 pb-2 sm:grid-cols-2">
              {memory.recentQuestions.slice(0, 4).map((item, index) => (
                <li key={`${item.askedAt}-${index}`} className="text-sm leading-6 text-[var(--muted)]">
                  <span className="mr-2 text-xs text-[var(--primary)]">{item.category}</span>
                  {item.question}
                </li>
              ))}
            </ol>
          ) : (
            <p className="pb-2 text-sm text-[var(--muted)]">
              ยังไม่มีคำถามเก่าสำหรับใช้เป็นบริบท เมื่อเริ่มถาม AI จะค่อย ๆ รู้จักคุณมากขึ้น
            </p>
          )}
        </details>
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        {confirmReset ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[var(--foreground)]">
              ลืมบริบทจากแชทเก่าทั้งหมด? ประวัติสนทนาจะไม่ถูกลบ
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={busy !== null}
                className="min-h-11 rounded-full px-4 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-3)]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void resetMemory()}
                disabled={busy !== null}
                className="min-h-11 rounded-full border border-[var(--danger)]/45 px-4 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-60"
              >
                {busy === "reset" ? "กำลังล้าง…" : "ยืนยันล้างความจำ"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={busy !== null || !hasChatMemory}
            className="min-h-11 text-sm text-[var(--muted)] underline decoration-[var(--border)] underline-offset-4 transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ล้างความจำจากแชทเก่า
          </button>
        )}
        {message ? <p role="status" className="mt-2 text-xs text-[var(--muted)]">{message}</p> : null}
        <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">
          ระบบใช้เฉพาะข้อความที่คุณพิมพ์ ไม่ใช้คำตอบเก่าของ AI เป็นข้อเท็จจริง
        </p>
      </div>
    </section>
  );
}
