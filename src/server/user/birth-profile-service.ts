import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { buildBirthDateUtc, type YearEra } from "@/lib/date";
import { queueNatalChart } from "@/server/horoscope/natal-chart-service";
import type { Role } from "@prisma/client";

/**
 * Birth profile service. Enforces the Milestone 2 rules:
 *   - year is accepted as Buddhist (พ.ศ.) or Gregorian (ค.ศ.) and normalized to
 *     Gregorian, stored as a UTC instant (rule 13)
 *   - birth info may be edited only ONCE more after creation (editCount 0 -> 1)
 *   - province/district are required; birthLocation is composed for the AI prompt
 *   - ADMIN / SUPER_ADMIN bypass the edit limit (unlimited edits)
 *
 * `editCount` semantics: 0 = created, never edited; 1 = edited once (max). An
 * update is rejected once editCount has already reached 1 (unless staff).
 */

export const MAX_BIRTH_EDITS = 1;

const STAFF_ROLES: Role[] = ["ADMIN", "SUPER_ADMIN"];

export function isStaffRole(role: Role | string | null | undefined): boolean {
  return Boolean(role && STAFF_ROLES.includes(role as Role));
}

/** True when the user may still submit one more birth-profile update. */
export function canEditBirthProfile(editCount: number): boolean {
  return editCount < MAX_BIRTH_EDITS;
}

/** Remaining edits allowed (0 or 1 under M2 rules). Staff → large sentinel. */
export function getEditsRemaining(
  editCount: number | null | undefined,
  options?: { unlimited?: boolean },
): number {
  if (options?.unlimited) return 999;
  if (editCount == null) return MAX_BIRTH_EDITS;
  return Math.max(0, MAX_BIRTH_EDITS - editCount);
}

export type BirthProfileInput = {
  nickname?: string;
  year: number;
  month: number;
  day: number;
  yearEra?: YearEra;
  birthTimeKnown?: boolean;
  hour?: number;
  minute?: number;
  gender?: string;
  birthCountry?: string;
  birthProvince: string;
  birthDistrict: string;
  additionalInfo?: string;
};

export async function getBirthProfile(userId: string) {
  return prisma.birthProfile.findUnique({ where: { userId } });
}

export async function upsertBirthProfile(
  userId: string,
  input: BirthProfileInput,
  options?: { unlimitedEdits?: boolean },
) {
  const existing = await prisma.birthProfile.findUnique({ where: { userId } });
  const unlimited = Boolean(options?.unlimitedEdits);

  if (existing && !unlimited && !canEditBirthProfile(existing.editCount)) {
    throw new AppError(
      "EDIT_LIMIT_REACHED",
      "แก้ไขข้อมูลวันเกิดได้เพียงครั้งเดียว ไม่สามารถแก้ไขเพิ่มได้",
    );
  }

  const birthTimeKnown = input.birthTimeKnown ?? true;
  const birthDate = buildBirthDateUtc({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: birthTimeKnown ? input.hour : 0,
    minute: birthTimeKnown ? input.minute : 0,
    era: input.yearEra,
  });

  const birthTime =
    birthTimeKnown && input.hour !== undefined && input.minute !== undefined
      ? `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`
      : null;

  const birthCountry = input.birthCountry?.trim() || "ไทย";
  // Composed free-text location kept in sync for the AI prompt builder.
  const birthLocation = [input.birthDistrict, input.birthProvince, birthCountry]
    .filter(Boolean)
    .join(", ");

  const data = {
    nickname: input.nickname ?? null,
    birthDate,
    birthTime,
    birthTimeKnown,
    gender: input.gender ?? null,
    birthCountry,
    birthProvince: input.birthProvince,
    birthDistrict: input.birthDistrict,
    birthLocation,
    additionalInfo: input.additionalInfo ?? null,
  };

  if (!existing) {
    const profile = await prisma.birthProfile.create({
      data: { userId, ...data, editCount: 0 },
    });
    // Do not await scrape/compute — it can take 10–60s and freezes the form.
    void queueNatalChart(userId, profile.id);
    return profile;
  }

  // Staff re-edits do not burn the one-time quota used by normal users.
  const profile = await prisma.birthProfile.update({
    where: { userId },
    data: unlimited
      ? { ...data }
      : { ...data, editCount: { increment: 1 } },
  });
  void queueNatalChart(userId, profile.id);
  return profile;
}

/** Admin support: reset a user's birth edit quota to 0. */
export async function resetBirthEditCount(userId: string) {
  const existing = await prisma.birthProfile.findUnique({ where: { userId } });
  if (!existing) throw new AppError("NOT_FOUND", "ยังไม่มีข้อมูลวันเกิด");
  return prisma.birthProfile.update({
    where: { userId },
    data: { editCount: 0 },
  });
}
