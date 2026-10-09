import { prisma } from "@/server/db";
import { isValidUnsubscribe } from "@/server/notify/weekly-days-service";

function page(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>HoraSard</title></head><body style="font-family:sans-serif;padding:40px 16px;text-align:center;background:#111;color:#eee">${body}<p><a style="color:#d4a640" href="/calendar">ไปหน้าปฏิทินดวง</a></p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function params(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  return { userId, token, valid: isValidUnsubscribe(userId, token), search: url.search };
}

/**
 * The link in the email asks first. It used to switch the email off on GET,
 * and mail scanners open every link — people were unsubscribed unseen.
 */
export async function GET(req: Request) {
  const { valid, search } = params(req);
  if (!valid) return page("<p>ลิงก์ไม่ถูกต้องหรือหมดอายุ — ปิดได้ที่หน้าปฏิทินดวงหลังเข้าสู่ระบบ</p>", 400);
  const action = `/api/notify/weekly-days/unsubscribe${search.replace(/"/g, "&quot;")}`;
  return page(
    `<p>เลิกรับอีเมลวันดีประจำสัปดาห์?</p><form method="post" action="${action}"><button type="submit" style="margin-top:8px;padding:10px 20px;border-radius:999px;border:0;background:#d4a640;color:#111;font-weight:600;cursor:pointer">เลิกรับอีเมลนี้</button></form>`,
  );
}

/** The confirm button, and one-click unsubscribe from mail apps (RFC 8058). */
export async function POST(req: Request) {
  const { userId, valid } = params(req);
  if (!valid) return page("<p>ลิงก์ไม่ถูกต้องหรือหมดอายุ — ปิดได้ที่หน้าปฏิทินดวงหลังเข้าสู่ระบบ</p>", 400);
  await prisma.user.updateMany({ where: { id: userId }, data: { weeklyDaysEmail: false } });
  return page("<p>ยกเลิกอีเมลวันดีประจำสัปดาห์แล้ว — เปิดรับใหม่ได้ที่หน้าปฏิทินดวง</p>");
}
