"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, DISTRICTS, PROVINCES } from "@/lib/th-geo";
import { useAppData } from "./app-data-provider";

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayParts() {
  const now = new Date();
  return {
    day: String(now.getDate()),
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    hour: pad2(now.getHours()),
    minute: pad2(now.getMinutes()),
  };
}

/**
 * Wave D — create a TRANSIT conversation with date/time/place, then open chat.
 * Pro-only; Free users see upgrade CTA.
 */
export function TransitFormModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, categories, refresh } = useAppData();
  const isPro = user?.plan === "PRO";
  const initial = todayParts();

  const unlockedCategories = useMemo(
    () =>
      categories.filter((c) => isPro || c.tier === "FREE"),
    [categories, isPro],
  );

  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [country, setCountry] = useState("ไทย");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [categorySlug, setCategorySlug] = useState(
    () => unlockedCategories[0]?.slug ?? "overview",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const districtOptions = province ? (DISTRICTS[province] ?? []) : [];
  const hasDistrictData = districtOptions.length > 0;
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => String(y - 2 + i));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPro) return;
    setError(null);

    if (!day || !month || !year || hour === "" || minute === "") {
      setError("กรุณากรอกวัน/เดือน/ปี และเวลาให้ครบ");
      return;
    }
    if (!categorySlug) {
      setError("กรุณาเลือกหมวดคำถาม");
      return;
    }

    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12) {
      setError("วันที่ไม่ถูกต้อง");
      return;
    }

    const transitDate = `${y}-${pad2(m)}-${pad2(d)}`;
    const transitTime = `${pad2(Number(hour))}:${pad2(Number(minute))}`;

    setSubmitting(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug,
          mode: "TRANSIT",
          transitDate,
          transitTime,
          transitCountry: country || undefined,
          transitProvince: province || undefined,
          transitDistrict: district || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { id?: string };
        error?: { message?: string; code?: string };
      } | null;

      if (!res.ok || !json?.ok || !json.data?.id) {
        setError(json?.error?.message ?? "สร้างดวงจรไม่สำเร็จ");
        return;
      }

      await refresh();
      onClose();
      router.push(`/dashboard?thread=${json.data.id}&cat=${categorySlug}`);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transit-form-title"
        className="animate-fade-up relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2
            id="transit-form-title"
            className="text-lg font-semibold text-[var(--foreground)]"
          >
            เริ่มดวงจร
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ระบุวัน–เวลาที่ต้องการดูดวงจร แล้วถาม AI ในหมวดที่เลือก
          </p>
        </div>

        {!isPro ? (
          <div className="space-y-4 px-5 py-6 text-center">
            <p className="text-sm text-[var(--muted)]">
              โหมดดวงจรสำหรับสมาชิก Pro เท่านั้น
            </p>
            <a
              href="/account"
              className="press-scale inline-flex rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              อัปเกรดเป็น Pro
            </a>
            <button
              type="button"
              onClick={onClose}
              className="block w-full text-sm text-[var(--muted-2)] hover:text-[var(--muted)]"
            >
              ปิด
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
            <label className="block text-xs text-[var(--muted)]">
              หมวดคำถาม
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              >
                {unlockedCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <FieldSelect label="วัน" value={day} onChange={setDay}>
                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect label="เดือน" value={month} onChange={setMonth}>
                {THAI_MONTHS.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect label="ปี (ค.ศ.)" value={year} onChange={setYear}>
                {years.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FieldSelect label="ชั่วโมง" value={hour} onChange={setHour}>
                {Array.from({ length: 24 }, (_, i) => pad2(i)).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FieldSelect>
              <FieldSelect label="นาที" value={minute} onChange={setMinute}>
                {Array.from({ length: 60 }, (_, i) => pad2(i)).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <label className="block text-xs text-[var(--muted)]">
              ประเทศ
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {country === "ไทย" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs text-[var(--muted)]">
                  จังหวัด (ไม่บังคับ)
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setDistrict("");
                    }}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">ใช้จากดวงกำเนิด</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  อำเภอ/เขต (ไม่บังคับ)
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    disabled={!province || !hasDistrictData}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
                  >
                    <option value="">
                      {province ? "ใช้จากดวงกำเนิด" : "เลือกจังหวัดก่อน"}
                    </option>
                    {districtOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="press-scale flex-1 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
              >
                {submitting ? "กำลังสร้าง…" : "เริ่มสนทนา"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs text-[var(--muted)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
      >
        {children}
      </select>
    </label>
  );
}
