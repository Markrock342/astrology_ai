"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, DISTRICTS, PROVINCES } from "@/lib/th-geo";
import { ChartEvidenceTable } from "@/components/app/chart-evidence-table";
import { HoroscopeChartPanel } from "@/components/app/horoscope-chart-panel";
import {
  WheelColumn,
  WheelGroup,
  type WheelOption,
} from "@/components/birth/wheel-picker";
import type { ChartJson } from "@/types/chart";

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
type Era = "BE" | "CE";
const CURRENT_CE = new Date().getFullYear();
const BUDDHIST_OFFSET = 543;

export function ChartCalculator() {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [era, setEra] = useState<Era>("BE");
  const [year, setYear] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [country, setCountry] = useState("ไทย");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [chart, setChart] = useState<ChartJson | null>(null);

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

  const safeDay = day && Number(day) > daysInMonth ? String(daysInMonth) : day;

  function selectEra(next: Era) {
    if (next === era) return;
    setEra(next);
    if (!year) return;
    const n = Number(year);
    if (!Number.isFinite(n)) return;
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

  const isThai = country === "ไทย";
  const districtOptions = isThai && province ? (DISTRICTS[province] ?? []) : [];
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

    const dayNum = Number(safeDay);
    const monthNum = THAI_MONTHS.indexOf(month) + 1;
    const yearNum = Number(year);
    if (!safeDay || !month || !year || !Number.isFinite(dayNum) || monthNum < 1) {
      setError("กรุณาเลือกวัน เดือน ปีเกิดให้ครบ");
      return;
    }
    if (!province.trim()) {
      setError("กรุณาระบุจังหวัด / สถานที่เกิด");
      return;
    }
    if (!timeUnknown && (hour === "" || minute === "")) {
      setError("กรุณาเลือกเวลาเกิด หรือบอกว่าไม่ทราบเวลา");
      return;
    }

    const payload = {
      year: yearNum,
      month: monthNum,
      day: dayNum,
      yearEra: era,
      birthTimeKnown: !timeUnknown,
      hour: timeUnknown ? 12 : Number(hour),
      minute: timeUnknown ? 0 : Number(minute),
      birthCountry: country,
      birthProvince: province,
      birthDistrict: district || province,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/calculator/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "คำนวณไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setChart(json.data.chart as ChartJson);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 shadow-2xl backdrop-blur sm:p-8"
      >
        <h2 className="text-lg font-semibold text-[var(--primary)]">
          กรอกข้อมูลวันเกิด
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          ใช้วัน เดือน ปี เวลา และสถานที่เกิด ตามหลักโหราศาสตร์ไทย
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
              เวลาเกิด (24 ชม.)
              {!timeUnknown ? (
                <span className="ml-1 text-[var(--primary)]">*</span>
              ) : null}
            </span>
            <div className={timeUnknown ? "pointer-events-none opacity-40" : ""}>
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
            <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--muted)]">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => {
                  const on = e.target.checked;
                  setTimeUnknown(on);
                  if (on) {
                    setHour("12");
                    setMinute("0");
                  }
                }}
                className="mt-0.5"
              />
              <span>ไม่ทราบเวลาเกิด — ใช้กลางวัน (12:00) เพื่อคำนวณเบื้องต้น</span>
            </label>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--muted)]">
              ประเทศที่เกิด <span className="text-[var(--primary)]">*</span>
            </span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setProvince("");
                setDistrict("");
              }}
              className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {isThai ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[var(--muted)]">
                  จังหวัดที่เกิด <span className="text-[var(--primary)]">*</span>
                </span>
                <select
                  value={province}
                  onChange={(e) => {
                    setProvince(e.target.value);
                    setDistrict("");
                  }}
                  className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="" disabled>
                    จังหวัด
                  </option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[var(--muted)]">
                  อำเภอ / เขตที่เกิด
                </span>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!hasDistrictData}
                  className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
                >
                  <option value="">
                    {!province
                      ? "เลือกจังหวัดก่อน"
                      : hasDistrictData
                        ? "อำเภอ / เขต"
                        : "ยังไม่มีข้อมูลอำเภอ"}
                  </option>
                  {districtOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[var(--muted)]">
                  รัฐ / จังหวัดที่เกิด <span className="text-[var(--primary)]">*</span>
                </span>
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[var(--muted)]">เมือง / เขตที่เกิด</span>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                />
              </label>
            </>
          )}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="press-scale mt-6 rounded-xl bg-[var(--primary)] px-10 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          {submitting ? "กำลังคำนวณ…" : "คำนวณราศีจักร"}
        </button>
      </form>

      {chart ? (
        <div className="flex flex-col gap-4">
          <HoroscopeChartPanel
            natal={chart}
            description="ลัคนา ราศีจักร ทักษา และตำแหน่งดาวจากสูตรสุริยยาตร์"
          />
          <ChartEvidenceTable chart={chart} mode="natal" />
          <p className="text-[11px] leading-relaxed text-[var(--muted-2)]">
            ผลนี้เป็นตำแหน่งดาวจากการคำนวณ ไม่ใช่คำทำนาย และไม่ใช่คำแนะนำทางการเงิน
            กฎหมาย หรือการแพทย์
          </p>
        </div>
      ) : null}
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
      aria-pressed={active}
      className={`inline-flex h-8 min-w-[3rem] items-center justify-center rounded-lg border px-3 text-xs font-medium leading-none transition ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted-2)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );
}
