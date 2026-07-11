import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        ข้อจำกัดความรับผิด
      </h1>
      
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <section className="rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-2)] p-4">
          <p className="font-medium text-[var(--primary)]">
            ⚠️ บริการนี้ให้บริการเพื่อความบันเทิงเท่านั้น
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">1. วัตถุประสงค์เพื่อความบันเทิง</h2>
          <p>
            Horasard (โหราศาสตร์) เป็นบริการดูดวงและการสนทนากับ AI ที่จัดทำขึ้นเพื่อความบันเทิงและเป็นแนวทางในการวางแผนชีวิตเท่านั้น
            ข้อมูลที่ได้รับจากบริการนี้ไม่ใช่การพยากรณ์ที่ถูกต้องเสมอไป
            และไม่ควรนำไปใช้เป็นการตัดสินใจที่สำคัญในชีวิตโดยตรง
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">2. ความถูกต้องของข้อมูล</h2>
          <p>
            ข้อมูลการทำนายดวงและคำแนะนำที่ได้รับจากระบบ AI อาจมีความคลาดเคลื่อนหรือไม่ถูกต้องตามความเป็นจริง
            Horasard ไม่รับประกันความถูกต้อง ความสมบูรณ์ หรือความเหมาะสมของข้อมูลใดๆ ที่ให้บริการ
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">3. ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย</h2>
          <p>
            บริการนี้ไม่ใช่คำแนะนำทางการแพทย์ การเงิน การลงทุน หรือกฎหมาย
            หากท่านมีความต้องการด้านสุขภาพ การเงิน หรือกฎหมาย
            โปรดปรึกษาผู้เชี่ยวชาญในสาขาที่เกี่ยวข้องโดยตรง
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">4. การตัดสินใจเป็นความรับผิดชอบของผู้ใช้</h2>
          <p>
            การตัดสินใจใดๆ ที่เกิดจากข้อมูลหรือคำแนะนำจากบริการนี้เป็นความรับผิดชอบของผู้ใช้เองทั้งหมด
            Horasard จะไม่รับผิดชอบต่อความเสียหาย การสูญเสีย หรือผลกระทบใดๆ ที่เกิดจากการตัดสินใจดังกล่าว
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">5. การจำกัดความรับผิด</h2>
          <p>
            Horasard ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการใช้หรือไม่สามารถใช้บริการได้
            รวมถึงแต่ไม่จำกัดเพียง ความเสียหายทางตรง ทางอ้อม บังเอิญ หรือเป็นผลต่อเนื่อง
            ที่เกิดจากการใช้บริการนี้
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">6. การใช้งานด้วยวิจารณญาณ</h2>
          <p>
            ผู้ใช้ควรใช้วิจารณญาณและพิจารณาข้อมูลจากบริการนี้อย่างรอบคอบ
            ไม่ควรพึ่งพาข้อมูลจากบริการนี้อย่างเดียวในการตัดสินใจที่สำคัญ
            และควรหาข้อมูลเพิ่มเติมจากแหล่งข้อมูลอื่นๆ ที่เชื่อถือได้
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">7. การติดต่อ</h2>
          <p>
            หากท่านมีข้อสงสัยหรือข้อเสนอแนะเกี่ยวกับบริการ
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
