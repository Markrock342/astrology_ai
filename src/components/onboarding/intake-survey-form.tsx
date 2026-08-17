"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTAKE_QUESTIONS,
  type IntakeAnswers,
  type IntakeQuestionId,
} from "@/lib/intake-survey";

type Draft = Partial<Record<IntakeQuestionId, string>>;

export function IntakeSurveyForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const answered = INTAKE_QUESTIONS.filter((q) => draft[q.id]).length;
  const complete = answered === INTAKE_QUESTIONS.length;

  const progressLabel = useMemo(
    () => `ตอบแล้ว ${answered} จาก ${INTAKE_QUESTIONS.length} ข้อ`,
    [answered],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) {
      setError("กรุณาตอบให้ครบทุกข้อ");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/intake", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: draft as IntakeAnswers }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      router.push("/dashboard?cat=self");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-up w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 shadow-2xl backdrop-blur sm:p-8"
    >
      <p className="text-xs text-[var(--muted)]">{progressLabel}</p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width]"
          style={{ width: `${(answered / INTAKE_QUESTIONS.length) * 100}%` }}
        />
      </div>

      <div className="mt-6 flex flex-col gap-7">
        {INTAKE_QUESTIONS.map((q, index) => (
          <fieldset key={q.id} className="min-w-0">
            <legend className="text-sm font-semibold text-[var(--foreground)]">
              <span className="mr-2 text-[var(--muted-2)]">{index + 1}.</span>
              {q.prompt}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const selected = draft[q.id] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`press-scale cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary)]/15 font-medium text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={selected}
                      onChange={() =>
                        setDraft((prev) => ({ ...prev, [q.id]: opt.value }))
                      }
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error ? (
        <p className="mt-5 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !complete}
        className="mt-8 w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "กำลังบันทึก…" : "ดูสรุปพื้นดวง"}
      </button>
    </form>
  );
}
