"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";

type Topic = "general" | "work" | "money" | "love";
type Day = { date: string; weekday: string; dayRole: string | null; score: number; reasons: string[] };
type Calendar = { year: number; month: number; days: Day[]; bestDates: string[] };

const TOPICS: { id: Topic; label: string }[] = [
  { id: "general", label: "ทั่วไป" },
  { id: "work", label: "การงาน" },
  { id: "money", label: "การเงิน" },
  { id: "love", label: "ความรัก" },
];
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEK_HEAD = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
/** Read once by a new chat's composer (chat-view ASK_HANDOFF_KEY). */
const ASK_HANDOFF_KEY = "horasard:askHandoff";

function bangkokToday(): { y: number; m: number; iso: string } {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, iso: now.toISOString().slice(0, 10) };
}

function tone(day: Day): { cell: string; label: string } {
  if (day.dayRole === "กาลกิณี" || day.score <= -2) {
    return { cell: "border-[var(--danger)]/50 bg-[var(--danger)]/10", label: "ควรระวัง" };
  }
  if (day.score >= 3) return { cell: "border-[var(--primary)] bg-[var(--primary)]/20", label: "ดีมาก" };
  if (day.score >= 1) return { cell: "border-[var(--primary)]/40 bg-[var(--primary)]/8", label: "ดี" };
  if (day.score < 0) return { cell: "border-[var(--danger)]/25 bg-[var(--danger)]/5", label: "ระวังเล็กน้อย" };
  return { cell: "border-[var(--border)] bg-[var(--surface-2)]", label: "ปกติ" };
}

/** Month calendar of the user's days — computed from their chart, no AI. */
export default function CalendarPage() {
  const router = useRouter();
  const today = bangkokToday();
  const [ym, setYm] = useState({ y: today.y, m: today.m });
  const [topic, setTopic] = useState<Topic>("general");
  const [data, setData] = useState<Calendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const key = `${ym.y}-${String(ym.m).padStart(2, "0")}:${topic}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== key && !error;

  useEffect(() => {
    let cancelled = false;
    const month = `${ym.y}-${String(ym.m).padStart(2, "0")}`;
    fetch(`/api/me/day-calendar?month=${month}&topic=${topic}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error?.message ?? "โหลดปฏิทินไม่สำเร็จ");
          return;
        }
        setError(null);
        setData(json.data as Calendar);
        setLoadedKey(`${month}:${topic}`);
      })
      .catch(() => !cancelled && setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง"));
    return () => {
      cancelled = true;
    };
  }, [ym.y, ym.m, topic]);

  const cells = useMemo(() => {
    if (!data?.days.length) return [];
    const firstWeekday = new Date(`${data.days[0]!.date}T00:00:00Z`).getUTCDay();
    return [...Array<Day | null>(firstWeekday).fill(null), ...data.days];
  }, [data]);

  const picked = data?.days.find((d) => d.date === selected) ?? null;
  const topicLabel = TOPICS.find((t) => t.id === topic)!.label;

  function shiftMonth(delta: number) {
    setSelected(null);
    setError(null);
    setYm(({ y, m }) => {
      const n = m + delta;
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n };
    });
  }

  function askAbout(day: Day) {
    const [y, m, d] = day.date.split("-").map(Number) as [number, number, number];
    const subject = topic === "general" ? "ดวง" : `เรื่อง${topicLabel}`;
    const question = `วัน${day.weekday}ที่ ${d} ${MONTHS_SHORT[m - 1]} ${y + 543} ${subject}ผมเป็นยังไง`;
    try {
      window.sessionStorage.setItem(ASK_HANDOFF_KEY, question);
    } catch {
      /* the chat still opens; the user types the question */
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex-1 px-4 py-10 pt-16 md:px-10 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">ปฏิทินดวง</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ทุกวันของเดือนเทียบกับดวงของคุณ — วันทักษา จันทร์จร และดาวจรในภพของเรื่อง แตะวันเพื่อดูเหตุผลหรือถามต่อ
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="เดือนก่อน">
              <ChevronLeft size={16} aria-hidden />
            </button>
            <p className="min-w-36 text-center text-base font-semibold text-[var(--foreground)]">
              {MONTHS[ym.m - 1]} {ym.y + 543}
            </p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="เดือนถัดไป">
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="เรื่องที่ดู">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={topic === t.id}
                onClick={() => {
                  setTopic(t.id);
                  setSelected(null);
                  setError(null);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  topic === t.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/15 font-medium text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="mt-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">{error}</p>
        ) : null}

        <div className={`mt-5 grid grid-cols-7 gap-1.5 transition-opacity ${loading ? "opacity-40" : ""}`}>
          {WEEK_HEAD.map((w) => (
            <p key={w} className="pb-1 text-center text-[11px] font-medium text-[var(--muted-2)]">{w}</p>
          ))}
          {cells.map((day, i) =>
            day ? (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelected(day.date)}
                aria-label={`${Number(day.date.slice(8))} ${tone(day).label}`}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm transition hover:-translate-y-0.5 ${tone(day).cell} ${
                  selected === day.date ? "ring-2 ring-[var(--primary)]" : ""
                } ${day.date < today.iso ? "opacity-45" : ""}`}
              >
                <span className={`font-medium ${day.date === today.iso ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                  {Number(day.date.slice(8))}
                </span>
                {data?.bestDates.includes(day.date) ? (
                  <span className="mt-0.5 text-[10px] leading-none text-[var(--primary)]">★</span>
                ) : day.dayRole === "กาลกิณี" ? (
                  <span className="mt-0.5 text-[10px] leading-none text-[var(--danger)]">!</span>
                ) : null}
              </button>
            ) : (
              <span key={`pad-${i}`} />
            ),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted-2)]">
          <span><span className="text-[var(--primary)]">★</span> วันเด่นของเดือน</span>
          <span><span className="text-[var(--danger)]">!</span> วันกาลกิณีของคุณ</span>
          <span>สีเข้ม = เกณฑ์ดีมาก · สีแดง = ควรระวัง</span>
        </div>

        {picked ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              วัน{picked.weekday}ที่ {Number(picked.date.slice(8))} {MONTHS[Number(picked.date.slice(5, 7)) - 1]} {Number(picked.date.slice(0, 4)) + 543}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">· {tone(picked).label} ({topicLabel})</span>
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[var(--muted)]">
              {(picked.reasons.length ? picked.reasons : ["ไม่มีเกณฑ์เด่นในวันนี้"]).map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => askAbout(picked)}
              className="press-scale mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              <MessageCircle size={15} aria-hidden /> ถามหมอดูเรื่องวันนี้
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--muted-2)]">แตะวันในปฏิทินเพื่อดูว่าเพราะอะไรถึงดีหรือควรระวัง</p>
        )}

        <WeeklyEmailSwitch />
      </div>
    </div>
  );
}

/** Opt-in for the Monday email of the week's good days. */
function WeeklyEmailSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/notifications")
      .then((r) => r.json())
      .then((json) => setOn(Boolean(json?.data?.weeklyDaysEmail)))
      .catch(() => setOn(false));
  }, []);

  async function toggle() {
    if (on === null || saving) return;
    const next = !on;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/me/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyDaysEmail: next }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      setOn(next);
      setNote(next ? "เปิดแล้ว — จะส่งให้ทุกเช้าวันจันทร์" : "ปิดแล้ว");
    } catch {
      setNote("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">อีเมลวันดีประจำสัปดาห์</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          ทุกเช้าวันจันทร์ ส่งวันเด่น 3 วันของสัปดาห์และวันที่ควรระวัง {note ? `· ${note}` : ""}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(on)}
        aria-label="อีเมลวันดีประจำสัปดาห์"
        disabled={on === null || saving}
        onClick={() => void toggle()}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
          on ? "bg-[var(--primary)]" : "bg-[var(--surface-2)] ring-1 ring-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
