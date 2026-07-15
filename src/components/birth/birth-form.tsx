"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, DISTRICTS, PROVINCES } from "@/lib/th-geo";
import {
  PrivacyConsentText,
  PrivacyPolicyModal,
} from "@/components/cms/privacy-policy-modal";
import { WheelColumn, WheelGroup, type WheelOption } from "./wheel-picker";
import type { CmsDocument } from "@/lib/cms-keys";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** Short month labels so three wheels fit a phone's width. */
const THAI_MONTHS_ABBR = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const PLACEHOLDER: WheelOption = { value: "", label: "—" };

type Era = "BE" | "CE"; // พ.ศ. / ค.ศ.

const CURRENT_CE = new Date().getFullYear();
const BUDDHIST_OFFSET = 543;

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
  consentBirthPrivacy = "ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัว",
  consentBirthEditLimit = "ฉันรับทราบว่าสามารถแก้ไขข้อมูลวันเกิดได้อีก 1 ครั้ง",
  privacyPolicy,
}: {
  editCount?: number;
  consentBirthPrivacy?: string;
  consentBirthEditLimit?: string;
  privacyPolicy?: CmsDocument;
}) {
  const router = useRouter();

  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [era, setEra] = useState<Era>("BE");
  const [year, setYear] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [country, setCountry] = useState("ไทย");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptEditLimit, setAcceptEditLimit] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(() => {
    const offset = era === "BE" ? BUDDHIST_OFFSET : 0;
    const list: number[] = [];
    for (let ce = CURRENT_CE; ce >= CURRENT_CE - 100; ce--) {
      list.push(ce + offset);
    }
    return list;
  }, [era]);

  const daysInMonth = useMemo(() => {
    if (!month || !year) return 31;
    const m = THAI_MONTHS.indexOf(month) + 1;
    if (m < 1) return 31;
    let gYear = Number(year);
    if (!Number.isFinite(gYear)) return 31;
    if (era === "BE") gYear -= BUDDHIST_OFFSET;
    return new Date(gYear, m, 0).getDate();
  }, [month, year, era]);

  // Clamp invalid day when month/year changes (avoid setState-in-effect lint).
  const safeDay =
    day && Number(day) > daysInMonth ? String(daysInMonth) : day;

  function selectEra(next: Era) {
    if (next === era) return;
    setEra(next);
    if (!year) return;
    const n = Number(year);
    if (!Number.isFinite(n)) return;
    // Convert displayed year so the selected birth year stays the same instant.
    if (era === "BE" && next === "CE") setYear(String(n - BUDDHIST_OFFSET));
    else if (era === "CE" && next === "BE") setYear(String(n + BUDDHIST_OFFSET));
  }

  function selectMonth(next: string) {
    setMonth(next);
    if (!day) return;
    const m = THAI_MONTHS.indexOf(next) + 1;
    if (m < 1) return;
    let gYear = Number(year) || CURRENT_CE;
    if (era === "BE") gYear -= BUDDHIST_OFFSET;
    const max = new Date(gYear, m, 0).getDate();
    if (Number(day) > max) setDay(String(max));
  }

  const districtOptions = province ? (DISTRICTS[province] ?? []) : [];
  const hasDistrictData = districtOptions.length > 0;

  const dayOptions = useMemo<WheelOption[]>(
    () => [
      PLACEHOLDER,
      ...Array.from({ length: daysInMonth }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
      })),
    ],
    [daysInMonth],
  );
  const monthOptions = useMemo<WheelOption[]>(
    () => [
      PLACEHOLDER,
      ...THAI_MONTHS.map((m, i) => ({ value: m, label: THAI_MONTHS_ABBR[i] })),
    ],
    [],
  );
  const yearOptions = useMemo<WheelOption[]>(
    () => [
      PLACEHOLDER,
      ...years.map((y) => ({ value: String(y), label: String(y) })),
    ],
    [years],
  );
  const hourOptions = useMemo<WheelOption[]>(
    () => [
      PLACEHOLDER,
      ...Array.from({ length: 24 }, (_, i) => ({
        value: String(i),
        label: String(i).padStart(2, "0"),
      })),
    ],
    [],
  );
  const minuteOptions = useMemo<WheelOption[]>(
    () => [
      PLACEHOLDER,
      ...Array.from({ length: 60 }, (_, i) => ({
        value: String(i),
        label: String(i).padStart(2, "0"),
      })),
    ],
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dayToUse = safeDay;
    if (dayToUse !== day) setDay(dayToUse);

    if (!dayToUse || !month || !year || hour === "" || minute === "") {
      setError("กรุณากรอกวัน/เดือน/ปี และเวลาเกิดให้ครบ");
      return;
    }
    if (!country || !province || (hasDistrictData && !district)) {
      setError("กรุณาเลือกสถานที่เกิดให้ครบ");
      return;
    }
    if (!acceptPrivacy || !acceptEditLimit) {
      setError("กรุณายอมรับเงื่อนไขทั้งสองข้อ");
      return;
    }

    const monthNum = THAI_MONTHS.indexOf(month) + 1;
    if (monthNum < 1) {
      setError("เดือนเกิดไม่ถูกต้อง");
      return;
    }
    const dayNum = Number(dayToUse);
    if (dayNum > daysInMonth) {
      setError(`เดือนนี้มีได้สูงสุดวันที่ ${daysInMonth}`);
      return;
    }

    const payload = {
      year: Number(year),
      month: monthNum,
      day: dayNum,
      yearEra: era,
      birthTimeKnown: true,
      hour: Number(hour),
      minute: Number(minute),
      birthCountry: country,
      birthProvince: province,
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
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="animate-fade-up stagger-1 w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 shadow-2xl backdrop-blur"
      >
        <h2 className="text-lg font-semibold text-[var(--primary)]">
          กรอกข้อมูลวันเกิด
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          สู่ฐานโหราศาสตร์ไทย สุริยคติ พิษณุโลกจันทรคติ ลงเลขศาสตร์ยูจิต แม่นระดับสั่งได้
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-[var(--muted)]">
                วัน / เดือน / ปีเกิด{" "}
                <span className="text-[var(--primary)]">*</span>
              </span>
              <span className="flex gap-1">
                <EraToggle era={era} value="BE" label="พ.ศ." onSelect={selectEra} />
                <EraToggle era={era} value="CE" label="ค.ศ." onSelect={selectEra} />
              </span>
            </div>
            <WheelGroup headers={["วัน", "เดือน", era === "BE" ? "พ.ศ." : "ค.ศ."]}>
              <WheelColumn
                options={dayOptions}
                value={safeDay}
                onChange={setDay}
                ariaLabel="วันที่เกิด"
              />
              <WheelColumn
                options={monthOptions}
                value={month}
                onChange={selectMonth}
                ariaLabel="เดือนเกิด"
              />
              <WheelColumn
                options={yearOptions}
                value={year}
                onChange={setYear}
                ariaLabel="ปีเกิด"
              />
            </WheelGroup>
          </div>

          <div className="w-full sm:w-[15rem]">
            <span className="mb-1.5 flex h-5 items-center text-[11px] text-[var(--muted)]">
              เวลาเกิด (24 ชม.) <span className="ml-1 text-[var(--primary)]">*</span>
            </span>
            <WheelGroup headers={["ชั่วโมง", "นาที"]}>
              <WheelColumn
                options={hourOptions}
                value={hour}
                onChange={setHour}
                ariaLabel="ชั่วโมงเกิด"
              />
              <WheelColumn
                options={minuteOptions}
                value={minute}
                onChange={setMinute}
                ariaLabel="นาทีเกิด"
              />
            </WheelGroup>
          </div>
        </div>

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

        <div className="mt-6 flex flex-col gap-3">
          <Checkbox checked={acceptPrivacy} onChange={setAcceptPrivacy}>
            {privacyPolicy ? (
              <PrivacyConsentText
                text={consentBirthPrivacy}
                onOpenPolicy={() => setPrivacyOpen(true)}
              />
            ) : (
              consentBirthPrivacy
            )}
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
          {submitting ? "กำลังบันทึก…" : "ทำนาย"}
        </button>
      </form>

      {privacyPolicy ? (
        <PrivacyPolicyModal
          doc={privacyPolicy}
          open={privacyOpen}
          onClose={() => setPrivacyOpen(false)}
        />
      ) : null}
    </>
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
          __html: required
            ? `${label} <span style="color:var(--primary)">*</span>`
            : label,
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
