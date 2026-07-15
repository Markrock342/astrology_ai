"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Button,
  Card,
  PageHeader,
  StatCard,
  TableSkeleton,
  adminFetch,
} from "./ui";

type ErrorItem = {
  id: string;
  message: string;
  stack: string | null;
  createdAt: string;
};

type ErrorList = {
  total: number;
  last24h: number;
  page: number;
  pageSize: number;
  items: ErrorItem[];
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function ErrorsPanel() {
  const [data, setData] = useState<ErrorList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setData(await adminFetch<ErrorList>(`/api/admin/errors?page=${page}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดบันทึก error ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function clearAll() {
    setClearing(true);
    try {
      await adminFetch(`/api/admin/errors`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ล้างบันทึกไม่สำเร็จ");
    } finally {
      setClearing(false);
    }
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <AdminPage>
      <PageHeader
        title="Error ของระบบ"
        description="ข้อผิดพลาดที่ระบบจับไม่ได้ (500) ถูกบันทึกที่นี่อัตโนมัติ — เห็นว่า production พังโดยไม่ต้องรอผู้ใช้บ่น"
      />

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="24 ชั่วโมงล่าสุด"
            value={data.last24h}
            tone={data.last24h > 0 ? "danger" : "green"}
            hint={data.last24h === 0 ? "ระบบนิ่งดี 🎉" : "ควรกดดูสาเหตุด้านล่าง"}
          />
          <StatCard label="ทั้งหมดที่ค้างอยู่" value={data.total} />
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end">
        {data && data.total > 0 ? (
          <Button variant="ghost" onClick={() => void clearAll()} disabled={clearing}>
            {clearing ? "กำลังล้าง…" : "ล้างบันทึกทั้งหมด (หลังตรวจแล้ว)"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <Card className="mt-4">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => void load()}>
              ลองใหม่
            </Button>
          </div>
        </Card>
      ) : loading ? (
        <div className="mt-4">
          <TableSkeleton />
        </div>
      ) : !data ? null : data.items.length === 0 ? (
        <Card className="mt-4">
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            ไม่มี error ค้างอยู่ 🎉
          </p>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {data.items.map((e) => (
            <Card key={e.id} className="!p-3">
              <details className="group/err">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-[var(--foreground)]">
                    {e.message}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--muted-2)]">
                    {when(e.createdAt)}
                  </span>
                </summary>
                {e.stack ? (
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--surface-2)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--muted)]">
                    {e.stack}
                  </pre>
                ) : (
                  <p className="mt-2 text-[10px] text-[var(--muted-2)]">
                    ไม่มี stack trace
                  </p>
                )}
              </details>
            </Card>
          ))}

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ก่อนหน้า
              </Button>
              <span className="text-xs text-[var(--muted)]">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                ถัดไป
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </AdminPage>
  );
}
