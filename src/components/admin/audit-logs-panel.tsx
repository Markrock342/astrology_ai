"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  PageHeader,
  Select,
  TableShell,
  Td,
  TextInput,
  Th,
  adminFetch,
} from "./ui";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  ipAddress: string | null;
  createdAt: string;
  admin: { email: string; name: string | null };
};

type AuditList = {
  total: number;
  page: number;
  pageSize: number;
  items: AuditLog[];
  entityTypes: string[];
};

const PAGE_SIZE = 25;

export function AuditLogsPanel() {
  const [data, setData] = useState<AuditList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (entityType) params.set("entityType", entityType);
      setData(await adminFetch<AuditList>(`/api/admin/audit-logs?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [page, search, entityType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AdminPage>
      <PageHeader
        title="Audit Logs"
        description="บันทึกการกระทำของแอดมินทั้งหมด — ใครทำอะไร เมื่อไหร่ พร้อมข้อมูลก่อน/หลัง"
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          placeholder="ค้นหา action / อีเมลแอดมิน / entity id"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">ทุกประเภท</option>
          {data?.entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <TableShell>
        <thead>
          <tr>
            <Th>เวลา</Th>
            <Th>แอดมิน</Th>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>รายละเอียด</Th>
          </tr>
        </thead>
        <tbody>
          {data && data.items.length === 0 && (
            <tr>
              <Td className="text-center text-xs text-[var(--muted)]" colSpan={5}>
                ยังไม่มีบันทึก
              </Td>
            </tr>
          )}
          {data?.items.map((log) => (
            <Fragment key={log.id}>
              <tr>
                <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                  {new Date(log.createdAt).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </Td>
                <Td className="text-xs">{log.admin.name ?? log.admin.email}</Td>
                <Td>
                  <Badge tone="gold">{log.action}</Badge>
                </Td>
                <Td className="text-xs text-[var(--muted)]">
                  {log.entityType}
                  {log.entityId ? ` · ${log.entityId.slice(0, 10)}…` : ""}
                </Td>
                <Td>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] underline hover:text-[var(--foreground)]"
                    onClick={() =>
                      setExpandedId(expandedId === log.id ? null : log.id)
                    }
                  >
                    {expandedId === log.id ? "ซ่อน" : "ดู before/after"}
                  </button>
                </Td>
              </tr>
              {expandedId === log.id && (
                <tr>
                  <Td className="bg-[var(--surface-2)]" colSpan={5}>
                    <div className="grid gap-3 text-[11px] md:grid-cols-2">
                      <div>
                        <p className="mb-1 font-medium text-[var(--muted)]">ก่อน</p>
                        <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--surface)] p-2 font-mono">
                          {JSON.stringify(log.beforeJson ?? null, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 font-medium text-[var(--muted)]">หลัง</p>
                        <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--surface)] p-2 font-mono">
                          {JSON.stringify(log.afterJson ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </Td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </TableShell>

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
