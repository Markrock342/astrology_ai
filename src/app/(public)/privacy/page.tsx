import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        นโยบายความเป็นส่วนตัว
      </h1>
      
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">1. ข้อมูลที่เราเก็บรวบรวม</h2>
          <p>
            Horasard (โหราศาสตร์) เก็บรวบรวมข้อมูลส่วนบุคคลที่จำเป็นเพื่อให้บริการดูดวงและสนทนากับ AI
            ซึ่งประกอบด้วย:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>ข้อมูลบัญชี: อีเมล ชื่อผู้ใช้ รหัสผ่าน (ที่เข้ารหัส)</li>
            <li>ข้อมูลส่วนตัว: วันเกิด เวลาเกิด สถานที่เกิด</li>
            <li>ข้อมูลการใช้งาน: ประวัติการสนทนา คำถามที่ถาม หมวดหมู่ที่เลือก</li>
            <li>ข้อมูลการชำระเงิน: ข้อมูลธุรกรรม (เราไม่เก็บข้อมูลบัตรเครดิตโดยตรง)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">2. วัตถุประสงค์ในการเก็บข้อมูล</h2>
          <p>
            เราใช้ข้อมูลที่เก็บรวบรวมเพื่อ:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>ให้บริการดูดวงและสนทนากับ AI ตามที่ผู้ใช้ต้องการ</li>
            <li>ปรับปรุส่วนตัวของผู้ใช้และประสบการณ์การใช้งาน</li>
            <li>ตรวจสอบและป้องกันการฉ้อโกงและการใช้งานที่ผิดกฎ</li>
            <li>วิเคราะห์และพัฒนาบริการให้ดีขึ้น</li>
            <li>ส่งข้อมูลและอัปเดตเกี่ยวกับบริการ (หากได้รับความยินยอม)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">3. การคุ้มครองข้อมูล</h2>
          <p>
            เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสมเพื่อปกป้องข้อมูลส่วนบุคคลของท่าน
            รวมถึงการเข้ารหัสข้อมูล การควบคุมการเข้าถึง และการตรวจสอบความปลอดภัยอย่างสม่ำเสมอ
            อย่างไรก็ตาม ไม่มีระบบความปลอดภัยใดที่สมบูรณ์แบบ 100%
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">4. การเปิดเผยข้อมูล</h2>
          <p>
            เราไม่ขาย ให้เช่า หรือเปิดเผยข้อมูลส่วนบุคคลของท่านให้บุคคลภายนอก
            ยกเว้นในกรณีต่อไปนี้:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>ได้รับความยินยอมจากท่านโดยชัดแจ้ง</li>
            <li>ตามที่กฎหมายกำหนดหรือเพื่อปฏิบัติตามคำสั่งศาล</li>
            <li>เพื่อปกป้องสิทธิและทรัพย์สินของเราและผู้ใช้</li>
            <li>กับผู้ให้บริการบุคคลที่สามที่จำเป็นต่อการให้บริการ (เช่น ระบบชำระเงิน AI provider)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">5. สิทธิของผู้ใช้</h2>
          <p>
            ท่านมีสิทธิในการ:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>เข้าถึงและตรวจสอบข้อมูลส่วนตัวของท่าน</li>
            <li>แก้ไขข้อมูลส่วนตัวที่ไม่ถูกต้อง (วันเกิดสามารถแก้ไขได้จำกัดจำนวนครั้ง)</li>
            <li>ขอให้ลบข้อมูลส่วนตัวหรือบัญชี (โดยติดต่อทีมงาน)</li>
            <li>ขอรับสำเนาข้อมูลส่วนตัวที่เราเก็บ</li>
            <li>คัดค้านหรือจำกัดการประมวลผลข้อมูล</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">6. การเก็บข้อมูล</h2>
          <p>
            เราเก็บข้อมูลส่วนตัวของท่านตราบเท่าที่จำเป็นเพื่อวัตถุประสงค์ในการให้บริการ
            เมื่อท่านขอลบบัญชี เราจะดำเนินการลบข้อมูลถาวรภายในระยะเวลาที่กำหนด
            ยกเว้นข้อมูลบางส่วนที่ต้องเก็บตามกฎหมายหรือเพื่อวัตถุประสงค์ทางกฎหมาย
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">7. การเปลี่ยนแปลงนโยบาย</h2>
          <p>
            Horasard ขอสงวนสิทธิ์ในการแก้ไขหรือเปลี่ยนแปลงนโยบายความเป็นส่วนตัวนี้
            หากมีการเปลี่ยนแปลงสำคัญ เราจะแจ้งให้ท่านทราบผ่านอีเมลหรือทางเว็บไซต์
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">8. การติดต่อ</h2>
          <p>
            หากท่านมีข้อสงสัยหรือข้อร้องเรียนเกี่ยวกับนโยบายความเป็นส่วนตัว
            สามารถติดต่อทีมงานผ่านช่องทางที่ระบุไว้ในเว็บไซต์
          </p>
        </section>
      </div>

      <Link
        href="/login"
        className="mt-8 inline-block text-sm text-[var(--primary)] hover:underline"
      >
        ← กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </main>
  );
}
