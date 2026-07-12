"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, DISTRICTS, PROVINCES } from "@/lib/th-geo";
import {
  THAI_BIRTH_MONTHS,
  thaiMonthToNumber,
  type BirthFormInitial,
} from "@/lib/birth-form";

const THAI_MONTHS = [...THAI_BIRTH_MONTHS];

type Era = "BE" | "CE"; // พ.ศ. / ค.ศ.

const CURRENT_CE = new Date().getFullYear();

/**
 * Birth-profile form (design 02). Year accepts พ.ศ. or ค.ศ.; the backend
 * normalizes to ค.ศ. and stores UTC. Country defaults to ไทย; province/district
 * are required. Submits to PUT /api/me/birth-profile.
 *
 * `editCount` is provided by the caller (0 on first entry). Backend enforces the
 * "edit at most once more" rule; this only mirrors it for messaging.
 */
export function BirthForm({
  editCount = 0,
  initial,
  consentBirthPrivacy = "ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัว",
  consentBirthEditLimit = "ฉันรับทราบว่าสามารถแก้ไขข้อมูลวันเกิดได้อีก 1 ครั้ง",
}: {
  editCount?: number;
  initial?: BirthFormInitial;
  consentBirthPrivacy?: string;
  consentBirthEditLimit?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [day, setDay] = useState(initial?.day ?? "");
  const [month, setMonth] = useState(initial?.month ?? "");
  const [era, setEra] = useState<Era>(initial?.era ?? "BE");
  const [year, setYear] = useState(initial?.year ?? "");
  const [hour, setHour] = useState(initial?.hour ?? "");
  const [minute, setMinute] = useState(initial?.minute ?? "");
  const [country, setCountry] = useState(initial?.country ?? "ไทย");
  const [province, setProvince] = useState(initial?.province ?? "");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptEditLimit, setAcceptEditLimit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(() => {
    const offset = era === "BE" ? 543 : 0;
    const list: number[] = [];
    for (let ce = CURRENT_CE; ce >= CURRENT_CE - 100; ce--) {
      list.push(ce + offset);
    }
    return list;
  }, [era]);

  const districtOptions = province ? (DISTRICTS[province] ?? []) : [];
  const hasDistrictData = districtOptions.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!day || !month || !year || hour === "" || minute === "") {
      setError("กรุณากรอกวัน/เดือน/ปี และเวลาเกิดให้ครบ");
      return;
    }
    if (!country || !province || (hasDistrictData && !district)) {
      setError("กรุณาเลือกสถานที่เกิดให้ครบ");
      return;
    }
    const monthNum = thaiMonthToNumber(month);
    if (!monthNum) {
      setError("กรุณาเลือกเดือนเกิดให้ถูกต้อง");
      return;
    }
    if (!acceptPrivacy || !acceptEditLimit) {
      setError("กรุณายอมรับเงื่อนไขทั้งสองข้อ");
      return;
    }

    // Backend contract (birthProfileSchema): numeric fields + yearEra; the
    // service normalizes พ.ศ. → ค.ศ. and stores the instant in UTC (rule 13).
    const payload = {
      year: Number(year),
      month: monthNum,
      day: Number(day),
      yearEra: era,
      birthTimeKnown: true,
      hour: Number(hour),
      minute: Number(minute),
      birthCountry: country,
      birthProvince: province,
      // Schema requires a district; use the province as fallback when we have
      // no district dataset for it yet.
      birthDistrict: district || province,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/me/birth-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-up stagger-1 w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur"
    >
      <h2 className="text-lg font-semibold text-[var(--primary)]">
        {isEdit ? "แก้ไขข้อมูลวันเกิด" : "กรอกข้อมูลวันเกิด"}
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {isEdit
          ? "ตรวจสอบข้อมูลเดิมแล้วแก้ไข — บันทึกแล้วระบบจะคำนวณดวงใหม่"
          : "สู่ฐานโหราศาสตร์ไทย สุริยคติ พิษณุโลกจันทรคติ ลงเลขศาสตร์ยูจิต แม่นระดับสั่งได้"}
      </p>

      {/* Date + time row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="วันที่เกิด" required>
          <Select value={day} onChange={setDay} placeholder="วันที่">
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="เดือนเกิด" required>
          <Select value={month} onChange={setMonth} placeholder="เดือน">
            {THAI_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex flex-col gap-1.5">
          <span className="flex h-5 items-center justify-between">
            <span className="text-[11px] text-[var(--muted)]">
              ปีเกิด <span className="text-[var(--primary)]">*</span>
            </span>
            <span className="flex gap-1">
              <EraToggle era={era} value="BE" label="พ.ศ." onSelect={setEra} />
              <EraToggle era={era} value="CE" label="ค.ศ." onSelect={setEra} />
            </span>
          </span>
          <Select value={year} onChange={setYear} placeholder="พ.ศ. / ค.ศ.">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>

        <Field label="เวลาเกิด" required>
          <Select value={hour} onChange={setHour} placeholder="ชม.">
            {Array.from({ length: 24 }, (_, i) => String(i)).map((h) => (
              <option key={h} value={h}>
                {h.padStart(2, "0")}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="&nbsp;">
          <Select value={minute} onChange={setMinute} placeholder="นาที">
            {Array.from({ length: 60 }, (_, i) => String(i)).map((m) => (
              <option key={m} value={m}>
                {m.padStart(2, "0")}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Location row */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="ประเทศที่เกิด" required>
          <Select value={country} onChange={setCountry} placeholder="ประเทศ">
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="จังหวัด / รัฐ ที่เกิด" required>
          <Select
            value={province}
            onChange={(v) => {
              setProvince(v);
              setDistrict("");
            }}
            placeholder="จังหวัด / รัฐ"
          >
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="อำเภอ / เขต ที่เกิด" required={hasDistrictData}>
          <Select
            value={district}
            onChange={setDistrict}
            placeholder={
              !province
                ? "เลือกจังหวัดก่อน"
                : hasDistrictData
                  ? "อำเภอ / เขต / เมือง"
                  : "ยังไม่มีข้อมูลอำเภอ"
            }
            disabled={!hasDistrictData}
          >
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Consent */}
      <div className="mt-6 flex flex-col gap-3">
        <Checkbox checked={acceptPrivacy} onChange={setAcceptPrivacy}>
          {consentBirthPrivacy}
        </Checkbox>
        <Checkbox checked={acceptEditLimit} onChange={setAcceptEditLimit}>
          {consentBirthEditLimit}
          {editCount > 0 && (
            <span className="ml-1 text-[var(--muted-2)]">
              (ใช้ไปแล้ว {editCount}/1)
            </span>
          )}
        </Checkbox>
      </div>

      {error && <p className="mt-4 text-xs text-[var(--danger)]">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="press-scale mt-6 self-start rounded-xl bg-[var(--primary)] px-10 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
      >
        {submitting ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "ทำนาย"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="flex h-5 items-center text-[11px] text-[var(--muted)]"
        dangerouslySetInnerHTML={{
          __html: required ? `${label} <span style="color:var(--primary)">*</span>` : label,
        }}
      />
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 pr-8 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--primary)]"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 16L4 7h16z" />
      </svg>
    </div>
  );
}

function EraToggle({
  era,
  value,
  label,
  onSelect,
}: {
  era: Era;
  value: Era;
  label: string;
  onSelect: (e: Era) => void;
}) {
  const active = era === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`inline-flex h-[18px] items-center rounded-md border px-1.5 text-[10px] leading-none transition ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted-2)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[var(--muted)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="leading-relaxed">{children}</span>
    </label>
  );
}
