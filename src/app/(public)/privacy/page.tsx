import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { APP_NAME_TH } from "@/config/constants";

export const metadata = {
  title: `นโยบายความเป็นส่วนตัว — ${APP_NAME_TH}`,
};

const LAST_UPDATED = "4 กรกฎาคม 2568";

type Section = { heading: string; body: string[] };

const SECTIONS: Section[] = [
  {
    heading: "1. ข้อมูลที่เราเก็บ",
    body: [
      "ข้อมูลบัญชี: อีเมล ชื่อผู้ใช้ และรหัสผ่าน (จัดเก็บแบบเข้ารหัส ไม่เก็บเป็นข้อความปกติ)",
      "ข้อมูลวันเกิด: วัน/เดือน/ปีเกิด เวลาเกิด และสถานที่เกิด (ประเทศ/จังหวัด/อำเภอ) เพื่อใช้คำนวณและทำนายดวง",
      "ข้อมูลการใช้งาน: ประวัติการสนทนากับ AI หมวดที่เลือก และการทำรายการเครดิต/แพ็กเกจ",
    ],
  },
  {
    heading: "2. วัตถุประสงค์ในการใช้ข้อมูล",
    body: [
      "ให้บริการทำนายดวงและสนทนากับ AI ตามข้อมูลวันเกิดของคุณ",
      "ยืนยันตัวตน จัดการบัญชี และดูแลความปลอดภัยของระบบ",
      "ปรับปรุงคุณภาพบริการและวิเคราะห์การใช้งานโดยรวม",
    ],
  },
  {
    heading: "3. การเปิดเผยข้อมูล",
    body: [
      "เราไม่ขายข้อมูลส่วนบุคคลของคุณให้บุคคลที่สาม",
      "เราอาจใช้ผู้ให้บริการภายนอกที่จำเป็น เช่น ระบบส่งอีเมลและผู้ให้บริการ AI ภายใต้ข้อตกลงรักษาความลับ",
      "เราอาจเปิดเผยข้อมูลเมื่อมีข้อกำหนดตามกฎหมายหรือคำสั่งของหน่วยงานที่มีอำนาจ",
    ],
  },
  {
    heading: "4. สิทธิของคุณ",
    body: [
      "ขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของคุณได้",
      "แก้ไขข้อมูลวันเกิดได้จำกัดจำนวนครั้งตามที่ระบบกำหนด เพื่อป้องกันการใช้วันเกิดของผู้อื่น",
      "ขอลบบัญชีได้โดยติดต่อทีมงานผ่านช่องทางด้านล่าง",
    ],
  },
  {
    heading: "5. การเก็บรักษาและความปลอดภัย",
    body: [
      "เราจัดเก็บข้อมูลบนระบบที่มีการควบคุมการเข้าถึง และเข้ารหัสข้อมูลสำคัญ เช่น รหัสผ่าน",
      "เราเก็บข้อมูลไว้เท่าที่จำเป็นต่อการให้บริการหรือตามที่กฎหมายกำหนด",
    ],
  },
  {
    heading: "6. ข้อจำกัดความรับผิด (Disclaimer)",
    body: [
      `บริการของ ${APP_NAME_TH} มีวัตถุประสงค์เพื่อความบันเทิงและการไตร่ตรองส่วนบุคคลเท่านั้น`,
      "คำทำนายไม่ใช่คำแนะนำทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต โปรดใช้วิจารณญาณ",
    ],
  },
  {
    heading: "7. การติดต่อ",
    body: [
      "หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ หรือต้องการใช้สิทธิของคุณ กรุณาติดต่อทีมงานผ่านอีเมลที่แจ้งไว้ในแอป",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        นโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งาน
      </h1>
      <p className="mt-2 text-xs text-[var(--muted-2)]">
        ปรับปรุงล่าสุด: {LAST_UPDATED}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        {APP_NAME_TH} (โหราศาสตร์) ให้ความสำคัญกับความเป็นส่วนตัวของคุณ
        เอกสารนี้อธิบายว่าเราเก็บ ใช้ และดูแลข้อมูลของคุณอย่างไร
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {section.heading}
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              {section.body.map((line, i) => (
                <li
                  key={i}
                  className="text-sm leading-relaxed text-[var(--muted)]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-[var(--muted-2)]">
        เอกสารนี้เป็นฉบับเริ่มต้น อาจมีการปรับปรุงรายละเอียดและข้อมูลติดต่อก่อนเปิดให้บริการจริง
      </p>
      <Link
        href="/login"
        className="mt-8 inline-block text-sm text-[var(--primary)] hover:underline"
      >
        ← กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </main>
  );
}
