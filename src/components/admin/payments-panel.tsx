"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminPage,
  Badge,
  Button,
  InfoBox,
  PageHeader,
  Select,
  TableShell,
  TableSkeleton,
  Td,
  TextInput,
  Th,
  adminFetch,
} from "./ui";

type Payment = {
  id: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  proofUrl: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  reviewer: { email: string; name: string | null } | null;
};

function slipSrc(p: Payment): string | null {
  if (!p.proofUrl) return null;
  if (/^https?:\/\//i.test(p.proofUrl)) return p.proofUrl;
  return `/api/payments/proof/${p.id}`;
}

function SlipLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ดูสลิปขยาย"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white"
      >
        ปิด
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

type PaymentList = {
  total: number;
  page: number;
  pageSize: number;
  items: Payment[];
};

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<Payment["status"], string> = {
  PENDING: "รอตรวจ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export function PaymentsPanel() {
  const [data, setData] = useState<PaymentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [zoomSlip, setZoomSlip] = useState<{ src: string; alt: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (status) params.set("status", status);
      setData(await adminFetch<PaymentList>(`/api/admin/payments?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function review(paymentId: string, decision: "APPROVED" | "REJECTED") {
    setBusyId(paymentId);
    try {
      await adminFetch(`/api/admin/payments/${paymentId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          status: decision,
          note: reviewNote[paymentId] || undefined,
          packageCode: decision === "APPROVED" ? "PRO" : undefined,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AdminPage>
      <PageHeader
        title="ตรวจการโอนเงิน"
        description="ผู้ใช้แจ้งชำระจากหน้าบัญชี — อนุมัติแล้วระบบเปิด Pro และเติมเครดิตให้อัตโนมัติ"
      />

      <InfoBox>
        <strong className="text-[var(--foreground)]">ขั้นตอน:</strong> ตรวจสลิป →
        กด <strong className="text-[var(--foreground)]">อนุมัติ</strong> (เปิด Pro) หรือ{" "}
        <strong className="text-[var(--foreground)]">ปฏิเสธ</strong> (แจ้งเหตุผลในหมายเหตุได้)
        · ข้อมูลบัญชีธนาคารแก้ได้ที่{" "}
        <Link href="/admin/settings" className="text-[var(--primary)] underline">
          ข้อความเว็บ → วิธีโอนเงิน Pro
        </Link>
      </InfoBox>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>แสดง:</span>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="max-w-[200px]"
          >
            <option value="">ทุกสถานะ</option>
            <option value="PENDING">รอตรวจ</option>
            <option value="APPROVED">อนุมัติแล้ว</option>
            <option value="REJECTED">ไม่อนุมัติ</option>
          </Select>
        </label>
      </div>

      {loading && !data ? (
        <TableSkeleton rows={8} />
      ) : (
      <TableShell>
        <thead>
          <tr>
            <Th>วันที่</Th>
            <Th>ผู้ใช้</Th>
            <Th>จำนวน</Th>
            <Th>สลิป</Th>
            <Th>สถานะ</Th>
            <Th>ดำเนินการ</Th>
          </tr>
        </thead>
        <tbody>
          {data && data.items.length === 0 && (
            <tr>
              <Td colSpan={6} className="text-center text-xs text-[var(--muted)]">
                ไม่มีรายการ
              </Td>
            </tr>
          )}
          {data?.items.map((p) => (
            <tr key={p.id}>
              <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                {new Date(p.createdAt).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </Td>
              <Td>
                <Link
                  href={`/admin/users/${p.user.id}`}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  {p.user.name ?? p.user.email}
                </Link>
              </Td>
              <Td className="text-sm font-medium">฿{p.amount}</Td>
              <Td className="text-xs text-[var(--muted)]">
                {p.proofUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      const src = slipSrc(p);
                      if (src) {
                        setZoomSlip({
                          src,
                          alt: `สลิป ${p.user.email}`,
                        });
                      }
                    }}
                    className="text-[var(--primary)] underline"
                  >
                    ดูสลิป
                  </button>
                ) : (
                  "—"
                )}
              </Td>
              <Td>
                <Badge
                  tone={
                    p.status === "APPROVED"
                      ? "green"
                      : p.status === "REJECTED"
                        ? "red"
                        : "gold"
                  }
                >
                  {STATUS_LABELS[p.status]}
                </Badge>
              </Td>
              <Td>
                {p.status === "PENDING" ? (
                  <div className="flex min-w-[200px] flex-col gap-2">
                    <TextInput
                      placeholder="หมายเหตุ (ถ้ามี)"
                      value={reviewNote[p.id] ?? ""}
                      onChange={(e) =>
                        setReviewNote({ ...reviewNote, [p.id]: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => review(p.id, "APPROVED")}
                        disabled={busyId === p.id}
                      >
                        อนุมัติ
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => review(p.id, "REJECTED")}
                        disabled={busyId === p.id}
                      >
                        ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-[var(--muted-2)]">
                    {p.reviewer?.email ?? "—"}
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          ทั้งหมด {data?.total ?? 0} · หน้า {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ←
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            →
          </Button>
        </div>
      </div>
      {zoomSlip ? (
        <SlipLightbox
          src={zoomSlip.src}
          alt={zoomSlip.alt}
          onClose={() => setZoomSlip(null)}
        />
      ) : null}
    </AdminPage>
  );
}
