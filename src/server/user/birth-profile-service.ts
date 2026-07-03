import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { buildBirthDateUtc, type YearEra } from "@/lib/date";

/**
 * Birth profile service. Enforces the Milestone 2 rules:
 *   - year is accepted as Buddhist (พ.ศ.) or Gregorian (ค.ศ.) and normalized to
 *     Gregorian, stored as a UTC instant (rule 13)
 *   - birth info may be edited only ONCE more after creation (editCount 0 -> 1)
 *   - province/district are required; birthLocation is composed for the AI prompt
 *
 * `editCount` semantics: 0 = created, never edited; 1 = edited once (max). An
 * update is rejected once editCount has already reached 1.
 */

export const MAX_BIRTH_EDITS = 1;

/** True when the user may still submit one more birth-profile update. */
export function canEditBirthProfile(editCount: number): boolean {
  return editCount < MAX_BIRTH_EDITS;
}

/** Remaining edits allowed (0 or 1 under M2 rules). */
export function getEditsRemaining(editCount: number | null | undefined): number {
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

export async function upsertBirthProfile(userId: string, input: BirthProfileInput) {
  const existing = await prisma.birthProfile.findUnique({ where: { userId } });

  if (existing && !canEditBirthProfile(existing.editCount)) {
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
    return prisma.birthProfile.create({ data: { userId, ...data, editCount: 0 } });
  }

  return prisma.birthProfile.update({
    where: { userId },
    data: { ...data, editCount: { increment: 1 } },
  });
}
