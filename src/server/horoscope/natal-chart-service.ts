import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";

const STUB_NOTE =
  "พื้นดวงเดิมรอคำนวณ — โครงสร้างพร้อมแล้ว จะเชื่อม engine จาก newhora ในเฟสถัดไป";

/** Queue or refresh a natal chart row after birth profile save (stub engine). */
export async function queueNatalChart(userId: string, birthProfileId: string) {
  return prisma.natalChart.upsert({
    where: { userId },
    create: {
      userId,
      birthProfileId,
      status: "PENDING",
      note: STUB_NOTE,
    },
    update: {
      birthProfileId,
      status: "PENDING",
      chartJson: Prisma.JsonNull,
      note: STUB_NOTE,
      computedAt: null,
    },
  });
}

export async function getNatalChart(userId: string) {
  return prisma.natalChart.findUnique({ where: { userId } });
}
