"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTAKE_QUESTIONS,
  type IntakeAnswers,
  type IntakeQuestionId,
} from "@/lib/intake-survey";

type Draft = Partial<Record<IntakeQuestionId, string | string[]>>;

const DRAFT_KEY = "horasard:intake-draft:v2";
const SURVEY_STEPS = [
  {
    title: "ชีวิตตอนนี้",
    description: "เลือกเรื่องที่กำลังใช้พลังและสถานการณ์ปัจจุบัน",
    questionIds: ["focus", "work", "finance"],
  },
  {
    title: "ความสัมพันธ์และสุขภาพ",
    description: "ช่วยให้คำสรุปแตะเรื่องใกล้ตัวได้ตรงขึ้น",
    questionIds: ["love", "health", "fortune"],
  },
  {
    title: "ตัวตนและเป้าหมาย",
    description: "บอกจุดแข็ง สิ่งที่อยากพัฒนา และรูปแบบคำตอบ",
    questionIds: ["strength", "improve", "goal", "style"],
  },
] as const satisfies ReadonlyArray<{
  title: string;
  description: string;
  questionIds: readonly IntakeQuestionId[];
}>;

function hasAnswer(value: Draft[IntakeQuestionId]): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function IntakeSurveyForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const answered = INTAKE_QUESTIONS.filter((q) =>
    hasAnswer(draft[q.id]),
  ).length;
  const complete = answered === INTAKE_QUESTIONS.length;
  const currentStep = SURVEY_STEPS[step];
  const currentQuestions = currentStep.questionIds.map(
    (id) => INTAKE_QUESTIONS.find((question) => question.id === id)!,
  );
  const currentComplete = currentQuestions.every((question) =>
    hasAnswer(draft[question.id]),
  );

  const progressLabel = useMemo(
    () =>
      `ขั้นที่ ${step + 1} จาก ${SURVEY_STEPS.length} · ตอบแล้ว ${answered} จาก ${INTAKE_QUESTIONS.length} ข้อ`,
    [answered, step],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (saved) setDraft(JSON.parse(saved) as Draft);
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

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
    setError(null);
  }

  function goNext() {
    if (!currentComplete) {
      setError("ตอบคำถามในขั้นนี้ให้ครบก่อน แล้วไปขั้นถัดไปได้เลย");
      return;
    }
    setError(null);
    setStep((current) => Math.min(SURVEY_STEPS.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      router.push("/dashboard");
      window.localStorage.removeItem(DRAFT_KEY);
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
      className="animate-fade-up w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8"
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

      <header className="mt-6 border-b border-[var(--border)] pb-5 text-left">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          {currentStep.title}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
          {currentStep.description}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-8">
        {currentQuestions.map((q) => {
          const index = INTAKE_QUESTIONS.findIndex((item) => item.id === q.id);
          return (
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
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          );
        })}
      </div>

      {error ? (
        <p className="mt-5 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-5 mt-8 flex gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 sm:static sm:mx-0 sm:px-0 sm:pb-0">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep((current) => Math.max(0, current - 1));
            }}
            className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
          >
            ย้อนกลับ
          </button>
        ) : null}
        {step < SURVEY_STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!currentComplete}
            className="min-h-11 flex-[1.5] rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ไปขั้นถัดไป
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting || !complete}
            className="min-h-11 flex-[1.5] rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "กำลังบันทึก…" : "ดูสรุปพื้นดวง"}
          </button>
        )}
      </div>
    </form>
  );
}
