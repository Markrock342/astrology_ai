import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BirthForm } from "@/components/birth/birth-form";
import {
  getBirthProfile,
  isStaffRole,
  MAX_BIRTH_EDITS,
} from "@/server/user/birth-profile-service";
import { requireSessionUserId } from "@/server/auth/session-guard";
import { getConsentTexts } from "@/server/settings/settings-service";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userId = await requireSessionUserId();
  const session = await auth();
  const staff = isStaffRole(session?.user?.role);

  // Also serves "เปลี่ยนวันเกิด" from settings — allowed while edits remain
  // (staff bypass the one-edit quota).
  const profile = await getBirthProfile(userId);
  if (profile && !staff && profile.editCount >= MAX_BIRTH_EDITS) {
    redirect("/dashboard");
  }

  const { birthPrivacy, birthEditLimit } = await getConsentTexts();

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
        {staff ? (
          <p className="mt-2 text-xs text-[var(--secondary-active)]">
            บัญชีแอดมิน — แก้ไขวันเกิดได้ไม่จำกัดครั้ง
          </p>
        ) : null}
      </div>
      <BirthForm
        editCount={profile?.editCount ?? 0}
        consentBirthPrivacy={birthPrivacy.text}
        consentBirthEditLimit={
          staff
            ? "บัญชีแอดมินแก้ไขวันเกิดได้ไม่จำกัด"
            : birthEditLimit.text
        }
      />
    </div>
  );
}
