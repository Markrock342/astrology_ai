import { redirect } from "next/navigation";
import { BirthForm } from "@/components/birth/birth-form";
import {
  getBirthProfile,
  MAX_BIRTH_EDITS,
} from "@/server/user/birth-profile-service";
import { requireSessionUserId } from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userId = await requireSessionUserId();

  // Also serves "เปลี่ยนวันเกิด" from settings — allowed while edits remain.
  const profile = await getBirthProfile(userId);
  if (profile && profile.editCount >= MAX_BIRTH_EDITS) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10">
      <div className="mb-8 max-w-2xl text-center">
        <h1 className="text-xl font-semibold leading-relaxed text-[var(--primary)] sm:text-2xl">
          ในทางโหราศาสตร์ไทย ดวงดาวเป็นเพียงเครื่องมือ
          <br />
          บอกจังหวะชีวิตเพื่อให้เราเตรียมพร้อม
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          การทำนายไม่ใช่การกำหนดชะตา แต่เป็นแนวทางให้เรารู้จังหวะ
          เพื่อวางแผนและลงมือทำอย่างมีสติ สิ่งที่สำคัญที่สุดคือการกระทำและจิตใจของเราเอง
          ไม่ว่าดวงจะบอกอะไร เราก็ยังเป็นผู้เลือกทางเดินของตัวเองได้เสมอ
        </p>
      </div>
      <BirthForm editCount={profile?.editCount ?? 0} />
    </div>
  );
}
