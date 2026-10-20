"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TurnstileField, turnstileRequired } from "@/components/auth/turnstile-field";

const CONTACT_DRAFT_KEY = "horasard.contact.message.v1";

export function ContactForm() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    turnstileRequired() ? null : "",
  );
  const [captchaRound, setCaptchaRound] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a browser-local draft after hydration
      setMessage(window.sessionStorage.getItem(CONTACT_DRAFT_KEY) ?? "");
    } catch {
      /* Storage can be unavailable in strict/private browser modes. */
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
      website: String(data.get("website") ?? ""),
      turnstileToken: turnstileToken ?? undefined,
    };
    setState("loading");
    setFeedback(null);

    if (turnstileRequired() && !turnstileToken) {
      setState("error");
      setFeedback("กรุณายืนยันว่าไม่ใช่บอท");
      return;
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { ok?: boolean; error?: { message?: string } };
      if (!response.ok || !json.ok) {
        setState("error");
        setFeedback(json.error?.message ?? "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่");
        setTurnstileToken(turnstileRequired() ? null : "");
        setCaptchaRound((round) => round + 1);
        return;
      }
      setState("success");
      setFeedback("ส่งข้อความแล้ว ทีมงานจะติดต่อกลับทางอีเมลที่แจ้งไว้ครับ");
      form.reset();
      setMessage("");
      try {
        window.sessionStorage.removeItem(CONTACT_DRAFT_KEY);
      } catch {
        /* no-op */
      }
    } catch {
      setState("error");
      setFeedback("เชื่อมต่อไม่ได้ ข้อความยังถูกเก็บไว้ในเครื่องนี้ กรุณาลองส่งอีกครั้ง");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-left sm:p-8"
    >
      <div className="grid gap-5">
        <div className="grid gap-2">
          <label htmlFor="contact-name" className="text-sm font-medium text-[var(--foreground)]">
            ชื่อของคุณ
          </label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            maxLength={80}
            className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="contact-email" className="text-sm font-medium text-[var(--foreground)]">
            อีเมลของคุณ
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="contact-message" className="text-sm font-medium text-[var(--foreground)]">
            รายละเอียด
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={2_000}
            rows={6}
            value={message}
            onChange={(event) => {
              const next = event.target.value;
              setMessage(next);
              try {
                window.sessionStorage.setItem(CONTACT_DRAFT_KEY, next);
              } catch {
                /* no-op */
              }
            }}
            className="resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-base leading-6 text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          />
          <p className="text-right text-[11px] tabular-nums text-[var(--muted-2)]">
            {message.length.toLocaleString("th-TH")} / 2,000
          </p>
        </div>
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="contact-website">เว็บไซต์</label>
          <input
            id="contact-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <TurnstileField
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          resetKey={captchaRound}
        />
        {feedback ? (
          <p
            role={state === "error" ? "alert" : "status"}
            className={state === "error" ? "text-sm text-[var(--danger)]" : "text-sm text-[var(--primary)]"}
          >
            {feedback}
          </p>
        ) : null}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted-2)]">
            ข้อมูลจะส่งให้ทีมงานทางอีเมลเท่านั้น
          </p>
          <button
            type="submit"
            disabled={state === "loading"}
            className="min-h-11 rounded-full bg-[var(--primary)] px-8 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            {state === "loading" ? "กำลังส่ง…" : "ส่งข้อความ"}
          </button>
        </div>
      </div>
    </form>
  );
}
