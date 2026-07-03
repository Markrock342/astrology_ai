import { env } from "@/config/env";

/**
 * Minimal, swappable email sender.
 *
 * Delivery strategy is chosen at runtime from env:
 *   - RESEND_API_KEY set  → send a real email via the Resend HTTP API.
 *   - otherwise           → "dev fallback": log the message to the server
 *                           console so the flow is fully testable without any
 *                           external service. No code change is needed to switch
 *                           on real delivery later — just set RESEND_API_KEY
 *                           (and EMAIL_FROM).
 *
 * Never throw to the caller in a way that leaks whether an address exists; the
 * caller decides what to reveal.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  /** Plain-text body (always provided). */
  text: string;
  /** Optional HTML body. */
  html?: string;
};

export type SendEmailResult = { ok: true; via: "resend" | "dev" } | { ok: false; error: string };

const DEFAULT_FROM = "HoraSard <onboarding@resend.dev>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = env.EMAIL_FROM || DEFAULT_FROM;

  if (env.RESEND_API_KEY) {
    return sendViaResend(input, from, env.RESEND_API_KEY);
  }

  // Dev fallback — no external service configured.
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
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend send failed:", res.status, body);
      return { ok: false, error: `Resend responded ${res.status}` };
    }
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
