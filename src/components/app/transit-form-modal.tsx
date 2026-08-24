"use client";

import { useMemo, useState } from "react";
import { useChatNav } from "./chat-nav";
import { COUNTRIES, DISTRICTS, PROVINCES } from "@/lib/th-geo";
import { useAppData } from "./app-data-provider";
import { SearchableSelect } from "@/components/ui/searchable-select";

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

function applyDateTimeParts(
  parts: ReturnType<typeof todayParts>,
  setters: {
    setDay: (value: string) => void;
    setMonth: (value: string) => void;
    setYear: (value: string) => void;
    setHour: (value: string) => void;
    setMinute: (value: string) => void;
  },
) {
  setters.setDay(parts.day);
  setters.setMonth(parts.month);
  setters.setYear(parts.year);
  setters.setHour(parts.hour);
  setters.setMinute(parts.minute);
}

type LocationFeedback =
  | { kind: "success"; message: string; attributionUrl: string }
  | { kind: "error"; message: string };

/**
 * Wave D — create a TRANSIT conversation with date/time/place, then open chat.
 * Pro-only; Free users see upgrade CTA.
 */
export function TransitFormModal({ onClose }: { onClose: () => void }) {
  const chatNav = useChatNav();
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
  const [locating, setLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] =
    useState<LocationFeedback | null>(null);

  const districtOptions = province ? (DISTRICTS[province] ?? []) : [];
  const hasDistrictData = districtOptions.length > 0;
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => String(y - 2 + i));
  }, []);

  async function handleUseCurrentMomentAndLocation() {
    applyDateTimeParts(todayParts(), {
      setDay,
      setMonth,
      setYear,
      setHour,
      setMinute,
    });
    setError(null);
    setLocationFeedback(null);

    if (!navigator.geolocation) {
      setLocationFeedback({
        kind: "error",
        message: "ตั้งวันเวลาให้แล้ว · อุปกรณ์นี้ไม่รองรับการค้นหาตำแหน่ง เลือกจังหวัดและเขตเองได้เลย",
      });
      return;
    }

    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 60_000,
          }),
      );
      const response = await fetch("/api/geo/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: {
          country?: string;
          province?: string;
          district?: string;
          areaLabel?: string;
          attributionUrl?: string;
        };
        error?: { message?: string };
      } | null;
      if (!response.ok || !json?.ok || !json.data?.province) {
        throw new Error(
          json?.error?.message ??
            "ค้นหาจังหวัดและเขตไม่ได้ เลือกจากช่องด้านล่างแทนได้เลย",
        );
      }
      setCountry(json.data.country ?? "ไทย");
      setProvince(json.data.province);
      setDistrict(json.data.district ?? "");
      setLocationFeedback({
        kind: "success",
        message: `พร้อมใช้ · ตอนนี้ · ${json.data.areaLabel ?? json.data.province}`,
        attributionUrl:
          json.data.attributionUrl ?? "https://www.openstreetmap.org/copyright",
      });
    } catch (caught) {
      const denied =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        caught.code === 1;
      setLocationFeedback({
        kind: "error",
        message: denied
          ? "ตั้งวันเวลาให้แล้ว · เปิดสิทธิ์ตำแหน่งให้ horasard.com แล้วกดอีกครั้ง หรือเลือกจังหวัดเอง"
          : `ตั้งวันเวลาให้แล้ว · ${
              caught instanceof Error
                ? caught.message
                : "ค้นหาตำแหน่งไม่ได้ เลือกจังหวัดเองได้เลย"
            }`,
      });
    } finally {
      setLocating(false);
    }
  }

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
      // Opening the new transit thread must not remount ChatView — see chat-nav.
      chatNav(`/dashboard?thread=${json.data.id}&cat=${categorySlug}`);
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
        className="animate-fade-up relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
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
            <p className="mx-auto max-w-xs rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-medium text-[var(--primary)]">
              สิทธิ์แพ็กเกจ Pro
            </p>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              ดวงจรยังไม่รวมใน Free · อัปเกรดแล้วเลือกวัน/เวลาที่อยากดูได้ทันที
            </p>
            <a
              href="/account"
              className="press-scale inline-flex rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              ดูแพ็กเกจ Pro
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
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleUseCurrentMomentAndLocation()}
                disabled={locating}
                className="press-scale flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[var(--primary)]/45 bg-[var(--primary)]/10 px-4 py-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary)]/15 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                  <CurrentLocationIcon locating={locating} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    {locating
                      ? "กำลังหาจังหวัดและเขต…"
                      : "ใช้วัน เวลา และตำแหน่งตอนนี้"}
                  </span>
                  <span className="block text-xs leading-5 text-[var(--muted)]">
                    กดครั้งเดียว ระบบเติมช่องด้านล่างให้
                  </span>
                </span>
              </button>
              {locationFeedback ? (
                <p
                  role="status"
                  aria-live="polite"
                  className={`text-xs leading-5 ${
                    locationFeedback.kind === "success"
                      ? "text-[var(--secondary-active)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {locationFeedback.message}
                  {locationFeedback.kind === "success" ? (
                    <>
                      {" · "}
                      <a
                        href={locationFeedback.attributionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-[var(--foreground)]"
                      >
                        © OpenStreetMap contributors
                      </a>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-[11px] leading-4 text-[var(--muted-2)]">
                  ระบบขอสิทธิ์ตำแหน่งเมื่อกดเท่านั้น และส่งต่อเพียงพิกัดแบบลดความละเอียดเพื่อหาเขต
                </p>
              )}
            </div>

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
                  <SearchableSelect
                    value={province}
                    onChange={(value) => {
                      setProvince(value);
                      setDistrict("");
                    }}
                    options={PROVINCES}
                    placeholder="พิมพ์หรือเลือกจังหวัด"
                    emptyLabel="ใช้จากดวงกำเนิด"
                    ariaLabel="จังหวัดสำหรับดวงจร"
                    className="mt-1.5"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  อำเภอ/เขต (ไม่บังคับ)
                  <SearchableSelect
                    value={district}
                    onChange={setDistrict}
                    options={districtOptions}
                    disabled={!province || !hasDistrictData}
                    placeholder={
                      province ? "พิมพ์หรือเลือกอำเภอ / เขต" : "เลือกจังหวัดก่อน"
                    }
                    emptyLabel="ใช้จากดวงกำเนิด"
                    ariaLabel="อำเภอหรือเขตสำหรับดวงจร"
                    className="mt-1.5"
                  />
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

function CurrentLocationIcon({ locating }: { locating: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={locating ? "animate-spin" : ""}
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
