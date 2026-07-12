import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { birthProfileToChartInput } from "@/server/horoscope/engine/birth-input-mapper";
import { computeNatalChart } from "@/server/horoscope/engine/compute-chart";
import { withPrismaRetry } from "@/server/prisma-utils";

const COMPUTING_NOTE = "กำลังคำนวณพื้นดวง…";

async function markNatalChartPending(userId: string, birthProfileId: string) {
  await withPrismaRetry(() =>
    prisma.natalChart.upsert({
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
    }),
  );
}

async function runNatalChartCompute(
  userId: string,
  birthProfileId: string,
) {
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { id: birthProfileId } }),
  );
  if (!profile) return;

  try {
    const input = birthProfileToChartInput(profile);
    // Scrape-first; may take 10–60s — never hold a DB connection during compute.
    const chartJson = await computeNatalChart(input);
    await withPrismaRetry(() =>
      prisma.natalChart.update({
        where: { userId },
        data: {
          status: "READY",
          chartJson: chartJson as object,
          note: null,
          computedAt: new Date(),
        },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "คำนวณพื้นดวงไม่สำเร็จ";
    await withPrismaRetry(() =>
      prisma.natalChart.update({
        where: { userId },
        data: {
          status: "FAILED",
          chartJson: Prisma.JsonNull,
          note: message,
        },
      }),
    ).catch(() => {});
  }
}

function scheduleNatalChartCompute(userId: string, birthProfileId: string) {
  const run = () => void runNatalChartCompute(userId, birthProfileId);
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Queue natal chart recompute after birth profile save (returns immediately). */
export async function queueNatalChart(userId: string, birthProfileId: string) {
  await markNatalChartPending(userId, birthProfileId);
  scheduleNatalChartCompute(userId, birthProfileId);
}

export async function getNatalChart(userId: string) {
  return prisma.natalChart.findUnique({ where: { userId } });
}

export async function recomputeNatalChart(userId: string) {
  rateLimit(`natal-recompute:${userId}`, 5, 60_000);
  const profile = await prisma.birthProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  await queueNatalChart(userId, profile.id);
  return getNatalChart(userId);
}
