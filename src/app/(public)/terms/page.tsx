import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/login" className="mb-8 inline-block">
        <BrandLogo size={36} />
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        เงื่อนไขการใช้บริการ
      </h1>
      
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">1. การยอมรับเงื่อนไข</h2>
          <p>
            การเข้าใช้งานและใช้บริการของ Horasard (โหราศาสตร์) ถือว่าท่านยอมรับและตกลงปฏิบัติตามเงื่อนไขการใช้บริการนี้
            หากท่านไม่ยอมรับเงื่อนไข โปรดงดเว้นจากการใช้บริการ
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">2. วัตถุประสงค์ของบริการ</h2>
          <p>
            Horasard ให้บริการดูดวงและการสนทนากับ AI เพื่อความบันเทิงและเป็นแนวทางในการวางแผนชีวิตเท่านั้น
            ข้อมูลที่ได้รับไม่ใช่การพยากรณ์ที่ถูกต้องเสมอไป และไม่ควรนำไปใช้เป็นการตัดสินใจที่สำคัญในชีวิตโดยตรง
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">3. ความรับผิดชอบของผู้ใช้</h2>
          <p>
            ผู้ใช้ต้องให้ข้อมูลที่ถูกต้องและเป็นจริง รวมถึงวันเกิดและข้อมูลส่วนตัวอื่นๆ
            ห้ามใช้บริการเพื่อวัตถุประสงค์ที่ผิดกฎหมาย หรือเป็นการล่วงละเมิดสิทธิของบุคคลอื่น
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">4. การเก็บข้อมูลและความเป็นส่วนตัว</h2>
          <p>
            เราเก็บข้อมูลส่วนตัวของท่านตามที่ระบุในนโยบายความเป็นส่วนตัว
            และจะไม่เปิดเผยข้อมูลดังกล่าวให้บุคคลภายนอกโดยไม่ได้รับความยินยอม
            ยกเว้นกรณีที่กฎหมายกำหนด
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">5. การชำระเงินและเครดิต</h2>
          <p>
            การซื้อแพ็กเกจและเครดิตเป็นการซื้อครั้งเดียวและไม่สามารถขอคืนเงินได้
            ยกเว้นกรณีที่ระบบมีข้อผิดพลาดที่ทำให้ไม่สามารถใช้บริการได้
            เครดิตที่ซื้อจะหมดอายุตามระยะเวลาที่กำหนดในแต่ละแพ็กเกจ
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">6. การแก้ไขและยกเลิกบัญชี</h2>
          <p>
            ผู้ใช้สามารถแก้ไขข้อมูลวันเกิดได้จำกัดจำนวนครั้งตามที่ระบบกำหนด
            หากต้องการลบบัญชี สามารถติดต่อทีมงานผ่านช่องทางที่ระบุไว้
            การลบบัญชีจะเป็นการลบข้อมูลถาวรและไม่สามารถกู้คืนได้
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">7. การเปลี่ยนแปลงเงื่อนไข</h2>
          <p>
            Horasard ขอสงวนสิทธิ์ในการแก้ไขหรือเปลี่ยนแปลงเงื่อนไขการใช้บริการโดยไม่ต้องแจ้งล่วงหน้า
            การใช้งานต่อเนื่องหลังจากมีการเปลี่ยนแปลงถือว่าท่านยอมรับเงื่อนไขใหม่
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-medium text-[var(--foreground)]">8. การจำกัดความรับผิด</h2>
          <p>
            Horasard ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการใช้หรือไม่สามารถใช้บริการได้
            รวมถึงความถูกต้องของข้อมูลการทำนายที่ได้รับจากระบบ
            ทุกการตัดสินใจเป็นความรับผิดชอบของผู้ใช้เอง
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
