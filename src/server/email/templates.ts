export const FACEBOOK_URL = "https://www.facebook.com/horasard";
type Block = string | { label: string; url: string };

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plain-text and HTML always contain the same information and fallback URLs. */
export function renderEmail(subject: string, blocks: Block[]) {
  const text = blocks.map(b => typeof b === "string" ? b : `${b.label}: ${b.url}`).join("\n\n");
  const html = `<div lang="th" style="font-family:Arial,sans-serif;line-height:1.8;color:#222;max-width:640px;margin:auto;padding:24px">${blocks.map(b => typeof b === "string"
    ? `<p style="white-space:pre-line">${escapeEmailHtml(b).replaceAll(FACEBOOK_URL, `<a href="${FACEBOOK_URL}">${FACEBOOK_URL}</a>`)}</p>`
    : `<p><a style="display:inline-block;background:#b89428;color:#111;padding:12px 20px;border-radius:8px;text-decoration:none" href="${escapeEmailHtml(b.url)}">${escapeEmailHtml(b.label)}</a></p><p style="font-size:12px;overflow-wrap:anywhere">หากคลิกปุ่มไม่ได้ ใช้ลิงก์นี้แทน: <a href="${escapeEmailHtml(b.url)}">${escapeEmailHtml(b.url)}</a></p>`).join("")}</div>`;
  return { subject, text, html };
}

export function emailGreeting(name?: string | null) {
  return name?.trim() ? `สวัสดีครับ คุณ ${name.trim()}` : "สวัสดีครับ";
}
export const emailSupport = `หากพบปัญหาในการใช้งาน สามารถสอบถามได้ที่ ${FACEBOOK_URL}`;
export const emailSignature = "ทีมงาน HORASARD.COM";

export function verificationEmail(name: string | null | undefined, url: string, hours: number) {
  return renderEmail("[HORASARD] กรุณายืนยันอีเมลของคุณ", [
    emailGreeting(name),
    "ยินดีต้อนรับสู่เว็บไซต์ HORASARD.COM ครับ ทางทีมงานมีความยินดีอย่างยิ่งที่คุณไว้วางใจให้เราเป็นส่วนหนึ่งในการวางแผนจังหวะชีวิตของคุณ",
    "เพื่อให้บัญชีของคุณมีความปลอดภัย และพร้อมสำหรับการใช้งานอย่างสมบูรณ์ รบกวนคลิกที่ปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ:",
    { label: "ยืนยันอีเมลของฉัน", url },
    `เพื่อความปลอดภัย ลิงก์นี้จะมีอายุการใช้งาน ${hours} ชั่วโมง`,
    "หากคุณไม่ได้สมัครบัญชีนี้ สามารถเพิกเฉยอีเมลนี้ได้", emailSupport,
    "ขอให้วันนี้เป็นวันที่ดีของคุณครับ\n" + emailSignature,
  ]);
}

export function passwordResetEmail(name: string | null | undefined, url: string, minutes: number) {
  return renderEmail("[HORASARD] แจ้งตั้งรหัสผ่านใหม่", [
    emailGreeting(name),
    "ทางเราได้รับคำขอให้ตั้งค่ารหัสผ่านใหม่สำหรับบัญชีของคุณ หากคุณเป็นผู้ทำรายการนี้ด้วยตนเอง สามารถตั้งรหัสผ่านใหม่ได้ที่ปุ่มด้านล่างเลย:",
    { label: "ตั้งรหัสผ่านใหม่", url }, `ลิงก์นี้สามารถใช้งานได้ภายใน ${minutes} นาที`,
    "หากคุณไม่ได้เป็นผู้ขอ สามารถเพิกเฉยอีเมลนี้ได้ รหัสผ่านเดิมจะยังไม่เปลี่ยนแปลง", emailSupport, emailSignature,
  ]);
}

export type PaymentEmailInput = {
  userName?: string | null; paymentId: string; packageName: string;
  approved: boolean; amount: number; paidAt: Date; note?: string | null; accountUrl: string;
};
export function paymentReviewedEmail(input: PaymentEmailInput) {
  const order = ` (Order: ${input.paymentId})`;
  const subject = input.approved
    ? `[HORASARD] ชำระเงินสำเร็จ เริ่มใช้งานได้เลย${order}`
    : `[HORASARD] การชำระเงินไม่สำเร็จ${order}`;
  const detail = input.approved ? [
    "เราได้รับยอดชำระเงินของคุณเรียบร้อยแล้ว ขอบคุณที่ไว้วางใจเลือกใช้บริการของ HORASARD.COM",
    `สรุปรายละเอียดรายการ:\n• หมายเลขคำสั่งซื้อ: ${input.paymentId}\n• แพ็กเกจของคุณ: ${input.packageName}\n• ยอดชำระ: ${input.amount.toLocaleString("th-TH")} บาท\n• วันและเวลา: ${new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(input.paidAt)} (เวลาไทย)`,
    "คุณสามารถเข้าสู่ระบบและเริ่มต้นใช้งานแพ็กเกจของคุณได้ทันที:",
    { label: "ไปยังเว็บไซต์", url: input.accountUrl },
  ] : [
    `ทีมงานขออภัยด้วยครับ ขณะนี้ระบบยังไม่สามารถยืนยันการทำรายการสำหรับคำสั่งซื้อ ${input.packageName} ของคุณได้สำเร็จ`,
    `สาเหตุที่ไม่อนุมัติ: ${input.note?.trim() || "กรุณาติดต่อทีมงานเพื่อตรวจสอบรายละเอียด"}`,
    "กรุณาตรวจสอบเหตุผลและหลักฐานเดิมก่อนส่งรายการใหม่ หากโอนเงินแล้ว ไม่ต้องโอนซ้ำ สามารถติดต่อทีมงานให้ช่วยตรวจสอบได้ครับ",
    { label: "ตรวจสอบและทำรายการอีกครั้ง", url: input.accountUrl },
  ];
  return renderEmail(subject, [emailGreeting(input.userName), ...detail, emailSupport, emailSignature]);
}
