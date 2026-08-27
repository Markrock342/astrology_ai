import { redirect } from "next/navigation";
import { IntakeSurveyForm } from "@/components/onboarding/intake-survey-form";
import { requireSessionUserId } from "@/server/auth/session-guard";
import { getBirthProfile } from "@/server/user/birth-profile-service";
import { hasIntake } from "@/server/user/intake-service";

export const dynamic = "force-dynamic";

export default async function OnboardingSurveyPage() {
  const userId = await requireSessionUserId();
  const profile = await getBirthProfile(userId);
  if (!profile) redirect("/onboarding");
  if (await hasIntake(userId)) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10">
      <div className="mb-8 max-w-xl text-center">
        <p className="text-xs font-medium tracking-wide text-[var(--primary)]">
          ขั้นตอนที่ 2 จาก 2
        </p>
        <h1 className="mt-2 text-xl font-semibold leading-relaxed text-[var(--foreground)] sm:text-2xl">
          เล่าชีวิตตอนนี้สั้น ๆ
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          ตอบ 10 ข้อ ใช้ประกอบสรุปพื้นดวงทุกหมวด — ข้อที่ชีวิตเกิดพร้อมกันได้เลือกได้หลายคำตอบ
          และไม่หัก usage
        </p>
      </div>
      <IntakeSurveyForm />
    </div>
  );
}
