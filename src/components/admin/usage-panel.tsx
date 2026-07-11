"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  PageHeader,
  Select,
  TableShell,
  TableSkeleton,
  Td,
  TextInput,
  Th,
  adminFetch,
} from "./ui";

type UsageLog = {
  id: string;
  provider: string;
  modelId: string;
  status: "SUCCESS" | "FAILED" | "TIMEOUT";
  inputUsage: number | null;
  outputUsage: number | null;
  estimatedCost: string | null;
  latencyMs: number | null;
  errorCode: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
};

type UsageList = {
  total: number;
  page: number;
  pageSize: number;
  items: UsageLog[];
};

const PAGE_SIZE = 25;

export function UsagePanel() {
  const [data, setData] = useState<UsageList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      setData(await adminFetch<UsageList>(`/api/admin/ai-usage?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AdminPage>
      <PageHeader
        title="Usage / AI Logs"
        description="ประวัติการเรียก AI — token, latency, สถานะ และ error"
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          placeholder="ค้นหาอีเมลผู้ใช้ / model"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">ทุกสถานะ</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
          <option value="TIMEOUT">TIMEOUT</option>
        </Select>
      </div>

      {loading && !data ? (
        <TableSkeleton rows={10} />
      ) : (
      <TableShell>
        <thead>
          <tr>
            <Th>เวลา</Th>
            <Th>ผู้ใช้</Th>
            <Th>Model</Th>
            <Th>สถานะ</Th>
            <Th>Tokens (in/out)</Th>
            <Th>Latency</Th>
          </tr>
        </thead>
        <tbody>
          {data && data.items.length === 0 && (
            <tr>
              <Td className="text-center text-xs text-[var(--muted)]" colSpan={6}>
                ยังไม่มีการเรียก AI
              </Td>
            </tr>
          )}
          {data?.items.map((log) => (
            <tr key={log.id}>
              <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                {new Date(log.createdAt).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
              </Td>
              <Td className="text-xs">{log.user.name ?? log.user.email}</Td>
              <Td className="text-xs text-[var(--muted)]">
                {log.provider} · {log.modelId}
              </Td>
              <Td>
                <Badge
                  tone={
                    log.status === "SUCCESS"
                      ? "green"
                      : log.status === "TIMEOUT"
                        ? "muted"
                        : "red"
                  }
                >
                  {log.status}
                  {log.errorCode ? ` (${log.errorCode})` : ""}
                </Badge>
              </Td>
              <Td className="text-xs tabular-nums text-[var(--muted)]">
                {log.inputUsage ?? "—"} / {log.outputUsage ?? "—"}
              </Td>
              <Td className="text-xs tabular-nums text-[var(--muted)]">
                {log.latencyMs != null ? `${log.latencyMs} ms` : "—"}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          ทั้งหมด {data?.total ?? 0} รายการ · หน้า {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← ก่อนหน้า
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            ถัดไป →
          </Button>
        </div>
      </div>
    </AdminPage>
  );
}
