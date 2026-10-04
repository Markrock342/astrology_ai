import { prisma } from "@/server/db";
import { isValidUnsubscribe } from "@/server/notify/weekly-days-service";

/** One click from the email, no sign-in: the signed link turns the email off. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const valid = isValidUnsubscribe(userId, token);
  if (valid) {
    await prisma.user.updateMany({ where: { id: userId }, data: { weeklyDaysEmail: false } });
  }
  const message = valid
    ? "ยกเลิกอีเมลวันดีประจำสัปดาห์แล้ว — เปิดรับใหม่ได้ที่หน้าปฏิทินดวง"
    : "ลิงก์ไม่ถูกต้องหรือหมดอายุ — ปิดได้ที่หน้าปฏิทินดวงหลังเข้าสู่ระบบ";
  return new Response(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HoraSard</title></head><body style="font-family:sans-serif;padding:40px 16px;text-align:center;background:#111;color:#eee"><p>${message}</p><p><a style="color:#d4a640" href="/calendar">ไปหน้าปฏิทินดวง</a></p></body></html>`,
    { status: valid ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
