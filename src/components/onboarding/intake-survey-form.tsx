"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTAKE_QUESTIONS,
  type IntakeAnswers,
  type IntakeQuestionId,
} from "@/lib/intake-survey";

type Draft = Partial<Record<IntakeQuestionId, string | string[]>>;

function hasAnswer(value: Draft[IntakeQuestionId]): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function IntakeSurveyForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const answered = INTAKE_QUESTIONS.filter((q) =>
    hasAnswer(draft[q.id]),
  ).length;
  const complete = answered === INTAKE_QUESTIONS.length;

  const progressLabel = useMemo(
    () => `ตอบแล้ว ${answered} จาก ${INTAKE_QUESTIONS.length} ข้อ`,
    [answered],
  );

  function toggleMultiple(
    questionId: IntakeQuestionId,
    value: string,
    exclusiveValues: string[] = [],
  ) {
    setDraft((previous) => {
      const current = Array.isArray(previous[questionId])
        ? previous[questionId]
        : [];
      const isExclusive = exclusiveValues.includes(value);
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : isExclusive
          ? [value]
          : [...current.filter((item) => !exclusiveValues.includes(item)), value];
      return { ...previous, [questionId]: next };
    });
  }

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
              {q.selection === "multiple" ? (
                <span className="ml-2 whitespace-nowrap text-[11px] font-normal text-[var(--primary)]">
                  เลือกได้หลายข้อ
                </span>
              ) : null}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const current = draft[q.id];
                const selected = Array.isArray(current)
                  ? current.includes(opt.value)
                  : current === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`press-scale inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-xs transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)] ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary)]/15 font-medium text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <input
                      type={q.selection === "multiple" ? "checkbox" : "radio"}
                      name={q.id}
                      value={opt.value}
                      checked={selected}
                      onChange={() => {
                        if (q.selection === "multiple") {
                          toggleMultiple(
                            q.id,
                            opt.value,
                            q.exclusiveValues,
                          );
                          return;
                        }
                        setDraft((prev) => ({ ...prev, [q.id]: opt.value }));
                      }}
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
