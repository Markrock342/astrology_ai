"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/app/user-avatar";

export function ProfileAvatarCard({
  name,
  email,
  image,
  canUpload,
  onUpdated,
}: {
  name: string;
  email: string;
  image: string | null;
  canUpload: boolean;
  onUpdated?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(image);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/me/avatar", { method: "POST", body: form });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { image: string };
        error?: { message: string };
      };
      if (!json.ok) {
        setMessage(json.error?.message ?? "อัปโหลดไม่สำเร็จ");
        return;
      }
      setPreview(json.data?.image ?? null);
      setMessage("อัปเดตรูปโปรไฟล์แล้ว");
      onUpdated?.();
      router.refresh();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center">
      <UserAvatar name={name} image={preview} size={72} />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">{name}</p>
        <p className="text-xs text-[var(--muted-2)]">{email}</p>
        {canUpload ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="press-scale mt-3 rounded-lg border border-[var(--primary)]/40 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/10 disabled:opacity-60"
            >
              {loading ? "กำลังอัปโหลด…" : "อัปโหลดรูปโปรไฟล์"}
            </button>
            <p className="mt-2 text-[11px] text-[var(--muted-2)]">
              JPG, PNG หรือ WebP — สูงสุด 512 KB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onFileChange(e)}
            />
          </>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">
            บัญชี Google ใช้รูปจาก Google โดยอัตโนมัติ
          </p>
        )}
        {message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}
      </div>
    </div>
  );
}
