import { prisma } from "@/server/db";
import { attachEmailProvider } from "./delivery-history";
import { env } from "@/config/env";

/**
 * Minimal, swappable email sender.
 *
 * Delivery strategy is chosen at runtime from env:
 *   - RESEND_API_KEY set  → send a real email via the Resend HTTP API.
 *   - otherwise (dev/test) → log to console so flows are testable offline.
 *   - production without RESEND_API_KEY → { ok: false } (never pretend it sent).
 */

export type SendEmailInput = {
  to: string;
  category?: "WEEKLY_DAYS" | "SYSTEM";
  replyTo?: string;
  subject: string;
  /** Plain-text body (always provided). */
  text: string;
  /** Optional HTML body. */
  html?: string;
  /** Extra headers, e.g. List-Unsubscribe for bulk mail. */
  headers?: Record<string, string>;
};

export type SendEmailResult = { ok: true; via: "resend" | "dev" } | { ok: false; error: string };

const DEFAULT_FROM = "HoraSard <onboarding@resend.dev>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let log;
  try {
    log = await prisma.emailDelivery.create({data:{recipient:input.to,subject:input.subject,category:input.category ?? "SYSTEM"}});
  } catch {
    return {ok:false,error:"Unable to record email send attempt"};
  }
  const result = await deliverEmail(input, log.id);
  try {
    if (!result.ok) await prisma.emailDelivery.update({where:{id:log.id},data:{status:"FAILED",error:result.error,statusAt:new Date()}});
    else if (result.via === "dev") await prisma.emailDelivery.update({where:{id:log.id},data:{status:"DEV",statusAt:new Date()}});
  } catch { console.error("[mailer] delivery history update failed",log.id); }
  return result;
}

async function deliverEmail(input: SendEmailInput, logId: string): Promise<SendEmailResult> {
  const from = env.EMAIL_FROM || DEFAULT_FROM;

  if (env.RESEND_API_KEY) {
    if (
      env.NODE_ENV === "production" &&
      (!env.EMAIL_FROM || /onboarding@resend\.dev/i.test(env.EMAIL_FROM))
    ) {
      console.error(
        "[mailer] EMAIL_FROM is missing or still the Resend sandbox sender — emails may not reach customers",
      );
    }
    return sendViaResend(input, from, env.RESEND_API_KEY, logId);
  }

  if (env.NODE_ENV === "production") {
    console.error("[mailer] RESEND_API_KEY unset in production — refusing to fake-send");
    return { ok: false, error: "Email is not configured in production" };
  }

  // Dev/test fallback — no external service configured.
  console.info(
    [
      "",
      "──────────────── [DEV EMAIL] ────────────────",
      `To:      ${input.to}`,
      `Subject: ${input.subject}`,
      "",
      input.text,
      "──────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
  return { ok: true, via: "dev" };
}

async function sendViaResend(
  input: SendEmailInput,
  from: string,
  apiKey: string,
  logId: string,
): Promise<SendEmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(input.headers ? { headers: input.headers } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend send failed:", res.status, body);
      return { ok: false, error: `Resend responded ${res.status}` };
    }
    const body = await res.json().catch(() => ({})) as {id?: string};
    if (typeof body.id === "string" && body.id) {
      try { await attachEmailProvider(logId, body.id); }
      catch { console.error("[mailer] provider accepted but history update failed",logId,body.id); }
    } else console.error("[mailer] provider response missing email id",logId);
    return { ok: true, via: "resend" };
  } catch (err) {
    console.error("Resend send error:", err);
    return { ok: false, error: "Email transport error" };
  }
}

/** True when real email delivery is configured (vs the dev console fallback). */
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}
