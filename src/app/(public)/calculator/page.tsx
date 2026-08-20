import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { ChartCalculator } from "@/components/calculator/chart-calculator";

export const metadata: Metadata = {
  title: "เครื่องคำนวณราศีจักร | HoraSard",
  description:
    "คำนวณลัคนา ราศีจักร ทักษา และตารางตำแหน่งดาวจากวันเกิด ตามหลักสุริยยาตร์",
};

export default function CalculatorPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 inline-block self-start">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        เครื่องคำนวณราศีจักร
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        ใส่วัน เดือน ปี เวลา และสถานที่เกิด แล้วดูราศีจักร ทักษา
        และตารางตำแหน่งดาวจากสูตรที่มีอยู่แล้ว ไม่บันทึกข้อมูล ไม่ต้องสมัคร
        และยังไม่ใช่คำทำนาย
      </p>
      <div className="mt-8">
        <ChartCalculator />
      </div>
    </main>
  );
}
