"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  PageHeader,
  Select,
  StatCard,
  TableSkeleton,
  adminFetch,
} from "./ui";

type Item = {
  id: string;
  value: "UP" | "DOWN";
  reason: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
  message: {
    id: string;
    content: string;
    modelId: string | null;
    question: string | null;
  };
};

type FeedbackList = {
  total: number;
  page: number;
  pageSize: number;
  items: Item[];
  stats: { up: number; down: number; satisfactionPct: number | null };
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

export function FeedbackPanel() {
  const [data, setData] = useState<FeedbackList | null>(null);
  // Default to the thumbs-down: praise is nice, complaints are work.
  const [value, setValue] = useState<"" | "UP" | "DOWN">("DOWN");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Tracked separately from `data`. Keying the skeleton off `!data` meant a
  // failed request left it spinning forever — the page looked like it was still
  // loading when in fact it had already given up.
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page) });
      if (value) q.set("value", value);
      setData(await adminFetch<FeedbackList>(`/api/admin/feedback?${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดฟีดแบ็กไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [value, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const s = data?.stats;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <AdminPage>
      <PageHeader
        title="ฟีดแบ็กจากผู้ใช้"
        description="ผู้ใช้กดนิ้วโป้งบนคำตอบไหนบ้าง — สัญญาณตรงตัวเดียวที่บอกว่าคำตอบดีหรือไม่ดี"
      />

      {s ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="👍 ดี" value={s.up} tone="green" />
          <StatCard
            label="👎 ไม่ดี"
            value={s.down}
            tone={s.down > 0 ? "danger" : "default"}
          />
          <StatCard
            label="ความพึงพอใจ"
            value={
              s.satisfactionPct != null
                ? `${s.satisfactionPct.toFixed(0)}%`
                : "—"
            }
            hint={
              s.up + s.down === 0
                ? "ยังไม่มีใครกด"
                : `จาก ${s.up + s.down} ครั้งที่กด`
            }
            tone="gold"
          />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Select
          value={value}
          onChange={(e) => {
            setValue(e.target.value as "" | "UP" | "DOWN");
            setPage(1);
          }}
          className="max-w-48"
        >
          <option value="DOWN">👎 เฉพาะที่ไม่ดี</option>
          <option value="UP">👍 เฉพาะที่ดี</option>
          <option value="">ทั้งหมด</option>
        </Select>
      </div>

      {/* Error and skeleton are mutually exclusive — showing both said "still
          loading" about a request that had already failed. */}
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
            {value === "DOWN"
              ? "ยังไม่มีคำตอบไหนถูกกดว่าไม่ดี 🎉"
              : "ยังไม่มีฟีดแบ็ก"}
          </p>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {data.items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={item.value === "UP" ? "green" : "red"}>
                    {item.value === "UP" ? "👍 ดี" : "👎 ไม่ดี"}
                  </Badge>
                  <span className="text-xs text-[var(--muted)]">
                    {item.user.name ?? item.user.email}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--muted-2)]">
                  {when(item.createdAt)}
                  {item.message.modelId ? ` · ${item.message.modelId}` : ""}
                </span>
              </div>

              {/* The question first: "this answer was bad" means nothing on its own. */}
              {item.message.question ? (
                <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--foreground)]">
                  <span className="text-[var(--muted-2)]">ถาม: </span>
                  {item.message.question}
                </p>
              ) : null}

              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
                {item.message.content.slice(0, 600)}
                {item.message.content.length > 600 ? "…" : ""}
              </p>

              {item.reason ? (
                <p className="mt-2 border-l-2 border-[var(--danger)]/50 pl-2 text-xs text-[var(--danger)]">
                  {item.reason}
                </p>
              ) : null}
            </Card>
          ))}

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
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
