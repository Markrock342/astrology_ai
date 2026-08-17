import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";
import {
  INTAKE_VERSION,
  intakeAnswersSchema,
  type IntakeAnswers,
} from "@/lib/intake-survey";

export async function getIntake(userId: string) {
  return prisma.userIntake.findUnique({
    where: { userId },
    select: {
      id: true,
      answers: true,
      version: true,
      completedAt: true,
    },
  });
}

export async function hasIntake(userId: string): Promise<boolean> {
  const row = await prisma.userIntake.findUnique({
    where: { userId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function upsertIntake(userId: string, raw: unknown) {
  const parsed = intakeAnswersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "กรุณาตอบแบบสำรวจให้ครบทุกข้อ");
  }
  const answers: IntakeAnswers = parsed.data;

  const row = await prisma.userIntake.upsert({
    where: { userId },
    create: {
      userId,
      answers,
      version: INTAKE_VERSION,
      completedAt: new Date(),
    },
    update: {
      answers,
      version: INTAKE_VERSION,
      completedAt: new Date(),
    },
    select: {
      id: true,
      answers: true,
      version: true,
      completedAt: true,
    },
  });
  invalidateUserBootstrap(userId);
  return row;
}

export function parseIntakeAnswers(json: unknown): IntakeAnswers | null {
  const parsed = intakeAnswersSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
