"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Modal,
  PageHeader,
  TableShell,
  TableSkeleton,
  Td,
  TextInput,
  Th,
  adminFetch,
} from "./ui";
import type { ReadingPromptTrace } from "@/types/reading-trace";
import type { TraceCheckResult } from "@/lib/reading-trace-check";

type ListItem = {
  id: string;
  question: string;
  modelId: string | null;
  status: string;
  createdAt: string;
  user: { email: string; name: string | null };
  hasTrace: boolean;
  intent: "natal" | "transit" | null;
  windowLabel: string | null;
  pickedByUser: boolean;
  knowledgeChunks: number;
  confirmed: number;
  flagged: number;
};

type ListData = { total: number; page: number; pageSize: number; items: ListItem[] };

type Detail = {
  id: string;
  question: string;
  answer: string | null;
  modelId: string | null;
  provider: string | null;
  status: string;
  createdAt: string;
  user: { email: string; name: string | null };
  category: { nameTh: string; slug: string } | null;
  trace: ReadingPromptTrace | null;
  check: TraceCheckResult | null;
};

const PAGE_SIZE = 25;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function fmtWindowDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

export function ReadingTracePanel() {
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      setData(await adminFetch<ListData>(`/api/admin/readings?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!openId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setDetailError(null);
    adminFetch<Detail>(`/api/admin/readings/${openId}`)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => {
        if (alive) setDetailError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [openId]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AdminPage>
      <PageHeader
        title="ตรวจสอบการอ่าน"
        description="ทุกคำตอบเก็บหลักฐานไว้ว่า AI ได้รับพื้นดวงชุดไหน ดวงจรวันไหน ตำราชิ้นไหน และบุคลิกเวอร์ชันไหน — พร้อมตรวจอัตโนมัติว่าคำตอบขัดกับตารางหรือไม่"
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          placeholder="ค้นหาคำถาม / อีเมลผู้ใช้"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading && !data ? (
        <TableSkeleton rows={10} />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>เวลา</Th>
              <Th>ผู้ใช้</Th>
              <Th>คำถาม</Th>
              <Th>อ่านจาก</Th>
              <Th>ตำรา</Th>
              <Th>ตรวจ</Th>
              <Th>โมเดล</Th>
              <Th>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && (
              <tr>
                <Td className="text-center text-xs text-[var(--muted)]" colSpan={8}>
                  ยังไม่มีการอ่าน
                </Td>
              </tr>
            )}
            {data?.items.map((item) => (
              <tr key={item.id} className="hover:bg-[var(--surface-2)]/50">
                <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                  {fmtTime(item.createdAt)}
                </Td>
                <Td className="max-w-[12rem]">
                  <p className="truncate text-xs">{item.user.name ?? "—"}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">{item.user.email}</p>
                </Td>
                <Td className="max-w-[20rem]">
                  <p className="line-clamp-2 text-sm">{item.question}</p>
                </Td>
                <Td className="whitespace-nowrap">
                  {!item.hasTrace ? (
                    <Badge>ก่อนมีระบบบันทึก</Badge>
                  ) : item.intent === "transit" ? (
                    <div className="flex flex-col gap-1">
                      <Badge tone="gold">ดวงจร{item.pickedByUser ? " · ผู้ใช้เลือกวัน" : ""}</Badge>
                      <span className="text-[11px] text-[var(--muted)]">{item.windowLabel}</span>
                    </div>
                  ) : (
                    <Badge tone="green">พื้นดวงเดิม</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs">
                  {item.hasTrace ? `${item.knowledgeChunks} ชิ้น` : "—"}
                </Td>
                <Td className="whitespace-nowrap">
                  {!item.hasTrace ? (
                    <span className="text-xs text-[var(--muted-2)]">—</span>
                  ) : item.flagged > 0 ? (
                    <Badge tone="red">ควรดู {item.flagged} จุด</Badge>
                  ) : (
                    <Badge tone="green">ตรงตาราง {item.confirmed} จุด</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-[11px] text-[var(--muted)]">
                  {item.modelId ?? "—"}
                </Td>
                <Td>
                  <Button variant="ghost" onClick={() => setOpenId(item.id)}>
                    ดูหลักฐาน
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>ทั้งหมด {data?.total ?? 0} รายการ</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <span>
            หน้า {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </Button>
        </div>
      </div>

      <Modal
        open={Boolean(openId)}
        title="หลักฐานการอ่าน"
        size="lg"
        onClose={() => setOpenId(null)}
      >
        {detailError ? (
          <p className="text-sm text-[var(--danger)]">{detailError}</p>
        ) : !detail ? (
          <p className="text-sm text-[var(--muted)]">กำลังโหลด…</p>
        ) : (
          <TraceDetail detail={detail} />
        )}
      </Modal>
    </AdminPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border)] pt-4">
      <h3 className="text-xs font-semibold text-[var(--muted)]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function PlanetRow({ planets }: { planets: Array<{ planet: string; sign: string }> }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {planets.map((row) => (
        <li
          key={row.planet}
          className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
        >
          {row.planet} <span className="text-[var(--muted)]">ราศี{row.sign}</span>
        </li>
      ))}
    </ul>
  );
}

function Raw({ label, text }: { label: string; text: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-[var(--primary)]">
        {label} ({text.length.toLocaleString()} ตัวอักษร)
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11px] leading-5 text-[var(--muted)]">
        {text}
      </pre>
    </details>
  );
}

function TraceDetail({ detail }: { detail: Detail }) {
  const { trace, check } = detail;
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs text-[var(--muted)]">
          {fmtTime(detail.createdAt)} · {detail.user.email} · {detail.modelId ?? "—"}
        </p>
        <p className="mt-1 font-medium text-[var(--foreground)]">{detail.question}</p>
      </div>

      {!trace ? (
        <p className="text-sm text-[var(--muted)]">
          การอ่านนี้เกิดก่อนระบบบันทึกหลักฐาน จึงมีเฉพาะคำถามและคำตอบ
        </p>
      ) : (
        <>
          <Section title="ตรวจอัตโนมัติ (เทียบคำตอบกับตารางที่ส่งให้ AI)">
            {check && check.flags.length > 0 ? (
              <ul className="space-y-2">
                {check.flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--danger)]" aria-hidden />
                    <span>
                      <span className="text-[var(--foreground)]">{flag.detail}</span>
                      <span className="block text-[var(--muted-2)]">“{flag.snippet}”</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                <span className="size-2 shrink-0 rounded-full bg-[var(--secondary-active)]" aria-hidden />
                ตำแหน่งดาว/ลัคนาที่คำตอบกล่าวถึง ตรงกับตาราง {check?.confirmed ?? 0} จุด ไม่พบจุดที่ขัดกัน
              </p>
            )}
            <p className="mt-2 text-[11px] text-[var(--muted-2)]">
              ตรวจเฉพาะข้อเท็จจริงเชิงตำแหน่ง (ดาวอยู่ราศีไหน ลัคนาราศีไหน) ไม่ได้ตัดสินความหมายที่ตีความ
            </p>
          </Section>

          <Section title="อ่านจาก">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={trace.intent === "transit" ? "gold" : "green"}>
                {trace.intent === "transit" ? "พื้นดวง + ดวงจร" : "พื้นดวงเดิมเท่านั้น"}
              </Badge>
              <span className="text-xs text-[var(--muted)]">
                ช่วงที่ถาม: {trace.window.label}
                {trace.window.pickedByUser ? " · ผู้ใช้เลือกวันเอง" : " · ระบบถอดจากคำถาม"}
              </span>
              <span className="text-xs text-[var(--muted)]">
                โหมด {trace.answerMode === "brief" ? "กระชับ" : "ละเอียด"} · แพ็กเกจ {trace.plan}
              </span>
            </div>
          </Section>

          <Section title={`พื้นดวงเดิมที่ส่งให้ AI · ลัคนา${trace.natal.lagna}`}>
            <p className="mb-2 text-[11px] text-[var(--muted-2)]">
              {trace.natal.birthDisplay ?? ""} · ที่มา {trace.natal.source ?? "—"}
            </p>
            <PlanetRow planets={trace.natal.planets} />
          </Section>

          {trace.transit ? (
            <Section title={`ดวงจรที่ส่งให้ AI · วันที่ ${trace.transit.asOf} · ลัคนา${trace.transit.lagna}`}>
              <p className="mb-2 text-[11px] text-[var(--muted-2)]">
                คำนวณ ณ {fmtWindowDate(trace.window.sampleAt)}
                {trace.window.horizonAt ? ` – ${fmtWindowDate(trace.window.horizonAt)}` : ""} · ที่มา{" "}
                {trace.transit.source ?? "—"}
              </p>
              <PlanetRow planets={trace.transit.planets} />
            </Section>
          ) : (
            <Section title="ดวงจร">
              <p className="text-xs text-[var(--muted)]">ไม่ได้ส่งดวงจร — คำถามนี้อ่านจากพื้นดวงเดิม</p>
            </Section>
          )}

          <Section
            title={`ตำราจากคลังความรู้ที่ส่งให้ AI · ${trace.knowledge.chunks.length} ชิ้น (${trace.knowledge.usedChars.toLocaleString()} / ${trace.knowledge.budgetChars.toLocaleString()} ตัวอักษร)`}
          >
            {trace.knowledge.chunks.length === 0 ? (
              <p className="text-xs text-[var(--danger)]">
                ไม่มีตำราถูกส่งไป — AI ถูกสั่งให้ตอบจากตารางดวงเท่านั้นและบอกว่าไม่มีตำรา
              </p>
            ) : (
              <ol className="space-y-1 text-xs">
                {trace.knowledge.chunks.map((chunk, i) => (
                  <li key={`${chunk.title}-${chunk.chunkIndex}`} className="flex gap-2">
                    <span className="w-5 shrink-0 text-[var(--muted-2)]">{i + 1}.</span>
                    <span>
                      {chunk.title}
                      <span className="text-[var(--muted)]">
                        {" "}· ส่วน {chunk.chunkIndex + 1}/{chunk.chunkCount} · {chunk.chars.toLocaleString()} ตัวอักษร · คะแนน {chunk.score}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="บุคลิกและกฎที่ใช้ (จากหน้า Prompt / Persona)">
            <ul className="flex flex-wrap gap-2 text-xs">
              {(["system", "persona", "format"] as const).map((key) => {
                const src = trace.templates[key];
                return (
                  <li key={key} className="rounded-full border border-[var(--border)] px-2.5 py-1">
                    {key === "system" ? "กฎความปลอดภัย" : key === "persona" ? "บุคลิก" : "รูปแบบคำตอบ"}:{" "}
                    {src ? `${src.code} v${src.version}` : "ค่าเริ่มต้นในโค้ด"}
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="ข้อความเต็มที่ส่งให้โมเดล">
            <Raw label="System prompt (กฎ + บุคลิก + ตำรา)" text={trace.systemPrompt} />
            <Raw label="User prompt (ตารางดวง + คำถาม)" text={trace.userPrompt} />
          </Section>
        </>
      )}

      <Section title="คำตอบ">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--foreground)]">
          {detail.answer ?? "—"}
        </pre>
      </Section>
    </div>
  );
}
