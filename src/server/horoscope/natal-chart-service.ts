import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { birthProfileToChartInput } from "@/server/horoscope/engine/birth-input-mapper";
import { computeNatalChart } from "@/server/horoscope/engine/compute-chart";

const COMPUTING_NOTE = "กำลังคำนวณพื้นดวง…";

/** Queue or recompute natal chart after birth profile save. */
export async function queueNatalChart(userId: string, birthProfileId: string) {
  await prisma.natalChart.upsert({
    where: { userId },
    create: {
      userId,
      birthProfileId,
      status: "PENDING",
      note: COMPUTING_NOTE,
    },
    update: {
      birthProfileId,
      status: "PENDING",
      chartJson: Prisma.JsonNull,
      note: COMPUTING_NOTE,
      computedAt: null,
    },
  });

  const profile = await prisma.birthProfile.findUnique({ where: { id: birthProfileId } });
  if (!profile) return;

  try {
    const input = birthProfileToChartInput(profile);
    const chartJson = computeNatalChart(input);
    await prisma.natalChart.update({
      where: { userId },
      data: {
        status: "READY",
        chartJson: chartJson as object,
        note: null,
        computedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "คำนวณพื้นดวงไม่สำเร็จ";
    await prisma.natalChart.update({
      where: { userId },
      data: {
        status: "FAILED",
        chartJson: Prisma.JsonNull,
        note: message,
      },
    });
  }
}

export async function getNatalChart(userId: string) {
  return prisma.natalChart.findUnique({ where: { userId } });
}

export async function recomputeNatalChart(userId: string) {
  const profile = await prisma.birthProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  await queueNatalChart(userId, profile.id);
  return getNatalChart(userId);
}
