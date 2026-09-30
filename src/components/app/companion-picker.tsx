"use client";

import { useId, useMemo, useState } from "react";
import { DISTRICTS, PROVINCES } from "@/lib/th-geo";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  COMPANION_RELATION_LABEL,
  COMPANION_RELATIONS,
  MAX_COMPANIONS,
  companionSchema,
  type Companion,
  type CompanionRelation,
} from "@/lib/companions";

/**
 * "ดูดวงคู่กับ…" — add a partner, a parent or anyone else and read their chart
 * with yours in the next questions.
 *
 * People added here are kept in this browser only, so they can be picked
 * again; their birth data goes to the server with each question and is not
 * stored there.
 */
const SAVED_KEY = "horasard.people.v1";

function loadSaved(): Companion[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    return list.flatMap((item) => {
      const parsed = companionSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function saveAll(people: Companion[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(people));
  } catch {
    /* private mode — the picker still works for this session */
  }
}

const same = (a: Companion, b: Companion) =>
  a.nickname === b.nickname && a.birthDate === b.birthDate && a.relation === b.relation;

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]";

export function CompanionPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Companion[];
  onChange: (next: Companion[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Companion[]>([]);
  const [adding, setAdding] = useState(false);
  const titleId = useId();


  const toggle = (person: Companion) => {
    const on = value.some((p) => same(p, person));
    if (on) onChange(value.filter((p) => !same(p, person)));
    else if (value.length < MAX_COMPANIONS) onChange([...value, person]);
  };

  const remove = (person: Companion) => {
    const next = saved.filter((p) => !same(p, person));
    setSaved(next);
    saveAll(next);
    onChange(value.filter((p) => !same(p, person)));
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setSaved(loadSaved());
          setOpen(true);
        }}
        className={`press-scale inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition ${
          value.length
            ? "border-[var(--primary)]/60 bg-[var(--primary)]/10 text-[var(--primary)]"
            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]"
        } disabled:opacity-50`}
      >
        <span aria-hidden>♡</span>
        {value.length ? `ดูดวงคู่กับ ${value.map((p) => p.nickname).join(", ")}` : "ดูดวงคู่"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="ปิด"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
              <div>
                <h2 id={titleId} className="text-sm font-semibold text-[var(--foreground)]">
                  ดูดวงคู่กับใคร
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  เลือกได้สูงสุด {MAX_COMPANIONS} คน · ดวงของคนที่เลือกจะถูกอ่านคู่กับดวงของคุณในคำถามถัดไป
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {saved.length ? (
                <ul className="mt-2 space-y-2">
                  {saved.map((person) => {
                    const on = value.some((p) => same(p, person));
                    return (
                      <li
                        key={`${person.nickname}-${person.birthDate}-${person.relation}`}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                          on ? "border-[var(--primary)]/60 bg-[var(--primary)]/8" : "border-[var(--border)]"
                        }`}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!on && value.length >= MAX_COMPANIONS}
                            onChange={() => toggle(person)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-[var(--foreground)]">
                              {person.nickname}
                              <span className="ml-1.5 text-[11px] text-[var(--muted)]">
                                {COMPANION_RELATION_LABEL[person.relation]}
                              </span>
                            </span>
                            <span className="block truncate text-[11px] text-[var(--muted)]">
                              เกิด {thaiDate(person.birthDate)}
                              {person.birthTime ? ` · ${person.birthTime} น.` : " · ไม่ทราบเวลา"}
                              {` · ${person.province}`}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => remove(person)}
                          className="shrink-0 text-[11px] text-[var(--muted-2)] hover:text-[var(--danger)]"
                        >
                          ลบ
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {adding || !saved.length ? (
                <AddPersonForm
                  onCancel={saved.length ? () => setAdding(false) : undefined}
                  onAdd={(person) => {
                    const next = [...saved.filter((p) => !same(p, person)), person];
                    setSaved(next);
                    saveAll(next);
                    if (value.length < MAX_COMPANIONS) onChange([...value, person]);
                    setAdding(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-3 w-full rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 text-sm text-[var(--primary)] hover:border-[var(--primary)]/60"
                >
                  + เพิ่มคน
                </button>
              )}

              <p className="mt-4 text-[11px] leading-5 text-[var(--muted-2)]">
                ข้อมูลวันเกิดของคนอื่นใช้เพื่อดูดวงคู่ในคำถามของคุณเท่านั้น ระบบไม่เก็บไว้ที่เซิร์ฟเวอร์
                รายชื่อที่บันทึกอยู่ในเครื่องนี้เท่านั้น
              </p>
              {value.length ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange([]);
                    setOpen(false);
                  }}
                  className="mt-3 text-[11px] text-[var(--muted)] underline"
                >
                  เลิกดูดวงคู่ กลับไปดูดวงตัวเองคนเดียว
                </button>
              ) : null}
            </div>

            <div className="border-t border-[var(--border)] px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="press-scale w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
              >
                {value.length ? `ใช้ ${value.length} คนนี้` : "ปิด"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AddPersonForm({
  onAdd,
  onCancel,
}: {
  onAdd: (person: Companion) => void;
  onCancel?: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [relation, setRelation] = useState<CompanionRelation>("partner");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [yearBE, setYearBE] = useState("");
  const [time, setTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);

  const thisYearBE = new Date().getFullYear() + 543;
  const years = useMemo(
    () => Array.from({ length: 110 }, (_, i) => String(thisYearBE - i)),
    [thisYearBE],
  );
  const districts = province ? (DISTRICTS[province] ?? []) : [];

  const submit = () => {
    const ceYear = Number(yearBE) - 543;
    const candidate = {
      nickname: nickname.trim(),
      relation,
      birthDate:
        day && month && yearBE
          ? `${ceYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
          : "",
      birthTime: timeUnknown ? null : time || null,
      country: "ไทย",
      province,
      district,
    };
    const check = new Date(`${candidate.birthDate}T00:00:00Z`);
    const realDate =
      candidate.birthDate &&
      check.getUTCDate() === Number(day) &&
      check.getUTCMonth() + 1 === Number(month);
    if (!candidate.nickname) return setError("ใส่ชื่อเล่น");
    if (!realDate) return setError("วันเกิดไม่ถูกต้อง");
    if (!timeUnknown && !time) return setError("ใส่เวลาเกิด หรือติ๊กว่าไม่ทราบเวลาเกิด");
    if (!province) return setError("เลือกจังหวัดที่เกิด");
    const parsed = companionSchema.safeParse(candidate);
    if (!parsed.success) return setError("ข้อมูลยังไม่ครบ");
    onAdd(parsed.data);
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--border)] p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-[var(--muted)]">
          ชื่อเล่น
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={40}
            placeholder="เช่น มายด์"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-[11px] text-[var(--muted)]">
          เป็นอะไรกับคุณ
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value as CompanionRelation)}
            className={`${inputClass} mt-1`}
          >
            {COMPANION_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {COMPANION_RELATION_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="text-[11px] text-[var(--muted)]">วันเกิด (พ.ศ.)</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <select value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} aria-label="วันที่เกิด">
            <option value="">วัน</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} aria-label="เดือนเกิด">
            <option value="">เดือน</option>
            {THAI_MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <select value={yearBE} onChange={(e) => setYearBE(e.target.value)} className={inputClass} aria-label="ปีเกิด พ.ศ.">
            <option value="">ปี</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-[var(--muted)]">
          เวลาเกิด
          <input
            type="time"
            value={time}
            disabled={timeUnknown}
            onChange={(e) => setTime(e.target.value)}
            className={`${inputClass} mt-1 w-32 disabled:opacity-40`}
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-[11px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={timeUnknown}
            onChange={(e) => setTimeUnknown(e.target.checked)}
          />
          ไม่ทราบเวลาเกิด
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="text-[11px] text-[var(--muted)]">
          จังหวัดที่เกิด
          <div className="mt-1">
            <SearchableSelect
              value={province}
              onChange={(v) => {
                setProvince(v);
                setDistrict("");
              }}
              options={PROVINCES}
              placeholder="จังหวัด"
              ariaLabel="จังหวัดที่เกิด"
            />
          </div>
        </div>
        <div className="text-[11px] text-[var(--muted)]">
          อำเภอ / เขต
          <div className="mt-1">
            <SearchableSelect
              value={district}
              onChange={setDistrict}
              options={districts}
              placeholder={province ? "อำเภอ" : "เลือกจังหวัดก่อน"}
              disabled={!districts.length}
              ariaLabel="อำเภอที่เกิด"
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-[11px] text-[var(--danger)]">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="press-scale flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
        >
          เพิ่ม
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]"
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </div>
  );
}
