import { contactFormSchema } from "@/lib/schemas";
import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { verifyTurnstile, clientIp } from "@/server/auth/turnstile";
import { sendEmail } from "@/server/email/mailer";
import { CMS_DEFAULTS, CMS_KEYS, type CmsContact } from "@/lib/cms-keys";
import { getPublishedSetting } from "@/server/settings/settings-service";

/** Public contact form: send to the CMS-managed support address, never store raw messages. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = contactFormSchema.parse(await req.json());
    await rateLimit(`contact:${rateLimitIp(req)}`, 5, 15 * 60_000, {
      failClosed: true,
      requireDistributed: true,
    });
    await verifyTurnstile(body.turnstileToken, clientIp(req));

    // A filled honeypot is treated as a successful no-op so bots do not learn
    // whether the endpoint accepted their message.
    if (body.website?.trim()) return ok({ sent: true });

    const contact = (await getPublishedSetting(CMS_KEYS.contact).catch(
      () => CMS_DEFAULTS[CMS_KEYS.contact],
    )) as CmsContact;
    const sent = await sendEmail({
      to: contact.email,
      replyTo: body.email,
      subject: `[HoraSard] ข้อความจาก ${body.name}`,
      text: [
        `ชื่อ: ${body.name}`,
        `อีเมล: ${body.email}`,
        "",
        body.message,
      ].join("\n"),
    });
    if (!sent.ok) {
      throw new AppError("INTERNAL", "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่หรือติดต่อทางอีเมล");
    }
    return ok({ sent: true });
  });
}
