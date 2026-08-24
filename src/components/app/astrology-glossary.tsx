import { HOUSE_MEANING, HOUSE_NAMES } from "@/lib/chart-theme";

const CORE_TERMS = [
  ["ลัคนา", "จุดเริ่มเรือนที่ 1 ใช้อ่านบุคลิกและทิศทางชีวิต"],
  ["ราศี", "พื้นที่ 12 ส่วนบนท้องฟ้าที่ดาวแต่ละดวงสถิตอยู่"],
  ["เรือน", "ด้านชีวิต 12 เรื่อง ซึ่งนับเริ่มจากลัคนา"],
  ["นวางศ์", "ผังย่อยที่ใช้ดูคุณภาพภายในของดาวและความสัมพันธ์"],
  ["ตรียางศ์", "ผังย่อยที่ใช้พิจารณาพลังการลงมือและรายละเอียดของดาว"],
  ["ทักษา", "การจัดบทบาทดาวตามวันและเวลาเกิด เช่น บริวาร อายุ เดช ศรี และกาลกิณี"],
  ["ตรีวัย", "การแบ่งช่วงวัยเพื่อดูว่าดาวใดเด่นในแต่ละช่วงชีวิต"],
] as const;

export function AstrologyGlossary({ compact = false }: { compact?: boolean }) {
  return (
    <details className="border-t border-[var(--border)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[var(--primary)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span>ศัพท์ในผังนี้แปลว่าอะไร</span>
        <span aria-hidden className="text-[var(--muted-2)]">＋</span>
      </summary>
      <div className="border-t border-[var(--border)] px-4 py-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {CORE_TERMS.slice(0, compact ? 3 : CORE_TERMS.length).map(
            ([term, meaning]) => (
              <div key={term} className="grid grid-cols-[5.5rem_1fr] gap-2">
                <dt className="font-semibold text-[var(--foreground)]">{term}</dt>
                <dd className="leading-6 text-[var(--muted)]">{meaning}</dd>
              </div>
            ),
          )}
        </dl>

        <p className="mb-3 mt-5 text-xs font-semibold tracking-wide text-[var(--primary)]">
          ชื่อเรือน 12 ภพ
        </p>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {HOUSE_NAMES.map((name, index) => (
            <div key={name} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="font-semibold text-[var(--foreground)]">
                {index + 1}. {name}
              </dt>
              <dd className="leading-6 text-[var(--muted)]">
                {HOUSE_MEANING[name]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
