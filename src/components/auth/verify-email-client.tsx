"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(
    token ? "" : "ลิงก์ยืนยันไม่ถูกต้อง",
  );

  useEffect(() => {
    if (!token) return;

    let alive = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((json: { ok: boolean; error?: { message: string } }) => {
        if (!alive) return;
        if (json.ok) {
          setStatus("ok");
          setMessage("ยืนยันอีเมลเรียบร้อยแล้ว");
        } else {
          setStatus("error");
          setMessage(json.error?.message ?? "ไม่สามารถยืนยันอีเมลได้");
        }
      })
      .catch(() => {
        if (alive) {
          setStatus("error");
          setMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        }
      });

    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <BrandLogo size={44} className="mb-10" />
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-8 text-center shadow-2xl backdrop-blur">
        {status === "loading" && (
          <p className="text-sm text-[var(--muted)]">กำลังยืนยันอีเมล…</p>
        )}
        {status === "ok" && (
          <>
            <h1 className="text-lg font-semibold text-[var(--primary)]">สำเร็จ</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
            <Link
              href="/dashboard"
              className="press-scale mt-6 inline-block rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
            >
              ไปหน้าแชท
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-lg font-semibold text-[var(--foreground)]">ไม่สำเร็จ</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm text-[var(--primary)] underline underline-offset-2"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
