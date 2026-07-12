"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Admin-only: enable Web Push on this device (PWA / Chrome mobile).
 * Registers service worker + stores subscription on the server.
 */
export function AdminPushEnable() {
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [status, setStatus] = useState<"idle" | "on" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/push/status");
      const json = await res.json();
      if (json?.ok) {
        setConfigured(Boolean(json.data.configured));
        setPublicKey(String(json.data.publicKey ?? ""));
      }
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) setStatus("on");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function enable() {
    setStatus("busy");
    setMessage(null);
    try {
      if (!configured || !publicKey) {
        setMessage("ยังไม่ได้ตั้ง VAPID keys บนเซิร์ฟเวอร์");
        setStatus("error");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("ยังไม่ได้อนุญาตการแจ้งเตือนในเบราว์เซอร์");
        setStatus("error");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = sub.toJSON();
      const res = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error?.message ?? "บันทึกการสมัครไม่สำเร็จ");
      }
      setStatus("on");
      setMessage("เปิดการแจ้งเตือนบนเครื่องนี้แล้ว");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "เปิดการแจ้งเตือนไม่สำเร็จ");
    }
  }

  if (!supported) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="text-xs font-medium text-[var(--foreground)]">
        แจ้งเตือนมือถือ (PWA)
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        ติดตั้งแอป / เปิดไซต์บนมือถือ แล้วกดอนุญาต — จะได้แจ้งเมื่อมีสลิปใหม่
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant={status === "on" ? "ghost" : "primary"}
          onClick={() => void enable()}
          disabled={status === "busy" || status === "on"}
        >
          {status === "on"
            ? "เปิดการแจ้งเตือนแล้ว"
            : status === "busy"
              ? "กำลังเปิด…"
              : "เปิดการแจ้งเตือน"}
        </Button>
        {message ? (
          <span
            className={`text-[11px] ${
              status === "error" ? "text-[var(--danger)]" : "text-[var(--secondary-active)]"
            }`}
          >
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
