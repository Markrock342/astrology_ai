"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Crown, Grid3x3, RotateCcw } from "lucide-react";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  CardTitle,
  ConfirmDialog,
  InfoBox,
  PageHeader,
  Select,
  ToastHost,
  adminFetch,
  useToast,
} from "./ui";
import {
  SIGN_DISPLAY,
  STANDARD_KINDS,
  STANDARD_PLANETS,
  STANDARD_SIGNS,
  formatPlanetStandardsForPrompt,
  type PlanetStandardsTable,
  type StandardKind,
  type StandardPlanet,
  type StandardSign,
} from "@/lib/planet-standards";

type Payload = {
  table: PlanetStandardsTable;
  defaults: PlanetStandardsTable;
  customised: boolean;
  updatedAt: string | null;
};

/** The four basic standards and the four เกณฑ์ the team asked for, coloured apart. */
const KIND_TONE: Record<StandardKind, string> = {
  อุจจ์: "text-emerald-300",
  นิจ: "text-rose-300",
  เกษตร: "text-sky-300",
  ประ: "text-orange-300",
  มหาจักร: "text-[var(--primary)]",
  ราชาโชค: "text-[var(--primary)]",
  เทวีโชค: "text-[var(--primary)]",
  จุลจักร: "text-[var(--primary)]",
};

const clone = (t: PlanetStandardsTable): PlanetStandardsTable => JSON.parse(JSON.stringify(t));

/**
 * Admin → มาตรฐานดาว. One table for sign lords and every planet's standards:
 * the chart table, the house chains and the AI all read it (22 Nov 2026).
 */
export function PlanetStandardsManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<PlanetStandardsTable | null>(null);
  const [cell, setCell] = useState<{ planet: StandardPlanet; kind: StandardKind } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    void adminFetch<Payload>("/api/admin/planet-standards")
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setDraft(clone(payload.table));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => Boolean(data && draft && JSON.stringify(draft) !== JSON.stringify(data.table)),
    [data, draft],
  );
  const preview = useMemo(() => (draft ? formatPlanetStandardsForPrompt(draft).join("\n") : ""), [draft]);

  function setLord(sign: StandardSign, planet: StandardPlanet) {
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      next.lords[sign] = planet;
      if (next.originalLords[sign] === planet) delete next.originalLords[sign];
      return next;
    });
  }
  function setOriginal(sign: StandardSign, planet: string) {
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      if (planet) next.originalLords[sign] = planet as StandardPlanet;
      else delete next.originalLords[sign];
      return next;
    });
  }
  function toggleSign(planet: StandardPlanet, kind: StandardKind, sign: StandardSign) {
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      const list = next.planets[planet][kind];
      next.planets[planet][kind] = list.includes(sign)
        ? list.filter((s) => s !== sign)
        : STANDARD_SIGNS.filter((s) => s === sign || list.includes(s));
      return next;
    });
  }

  async function save(reset = false) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await adminFetch<{ table: PlanetStandardsTable; customised: boolean }>("/api/admin/planet-standards", {
        method: "PUT",
        body: JSON.stringify(reset ? { reset: true } : { table: draft }),
      });
      setData((old) => (old ? { ...old, table: saved.table, customised: saved.customised, updatedAt: new Date().toISOString() } : old));
      setDraft(clone(saved.table));
      setConfirmReset(false);
      showToast(reset ? "คืนค่าเริ่มต้นแล้ว" : "บันทึกแล้ว — ตารางดาวและ AI ใช้ค่าใหม่ภายใน 1 นาที");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" disabled={busy || !data?.customised} onClick={() => setConfirmReset(true)}>
        <span className="inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" aria-hidden />คืนค่าเริ่มต้น</span>
      </Button>
      <Button variant="ghost" disabled={busy || !dirty} onClick={() => data && setDraft(clone(data.table))}>ยกเลิกที่แก้</Button>
      <Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? "กำลังบันทึก…" : "บันทึก"}</Button>
    </div>
  );

  return (
    <AdminPage>
      <PageHeader
        title="ตารางมาตรฐานดาว"
        description="เจ้าเรือนของแต่ละราศี และมาตรฐานของแต่ละดาว ที่ระบบใช้คำนวณจริง"
        hint="ใช้กับตารางดาวในหน้าแชท การไล่เจ้าเรือนภพผสมภพ และข้อมูลที่ส่งให้ AI ทุกคำถาม — คลังความรู้ใช้ตีความต่อจากตารางนี้ ถ้าคลังกับตารางไม่ตรงกัน ระบบยึดตารางนี้"
        action={actions}
      />
      <ToastHost toast={toast} />
      {error && <p role="alert" className="mb-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}
      {!draft || !data ? (
        <CardSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <Badge tone={data.customised ? "green" : "muted"}>{data.customised ? "ใช้ตารางที่ทีมแก้" : "ใช้ค่าเริ่มต้น"}</Badge>
            {data.updatedAt && <span>แก้ล่าสุด {new Date(data.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>}
            {dirty && <Badge tone="gold">มีการแก้ที่ยังไม่บันทึก</Badge>}
          </div>

          <Card>
            <CardTitle icon={Crown} title="เจ้าเรือนราศี" description="ดาวเจ้าเรือนของแต่ละราศี ใช้ไล่ภพผสมภพและช่องเจ้าเรือนในตาราง · เจ้าเรือนเดิมใส่เมื่อตำรายังนับดาวเดิมด้วย เช่น กุมภ์: ราหู (เดิม เสาร์)" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {STANDARD_SIGNS.map((sign) => (
                <div key={sign} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">{SIGN_DISPLAY[sign]}</p>
                  <label className="mt-2 block text-[11px] text-[var(--muted)]">
                    เจ้าเรือน
                    <Select className="mt-1" value={draft.lords[sign]} onChange={(e) => setLord(sign, e.target.value as StandardPlanet)}>
                      {STANDARD_PLANETS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </label>
                  <label className="mt-2 block text-[11px] text-[var(--muted)]">
                    เจ้าเรือนเดิม (ถ้ามี)
                    <Select className="mt-1" value={draft.originalLords[sign] ?? ""} onChange={(e) => setOriginal(sign, e.target.value)}>
                      <option value="">— ไม่มี —</option>
                      {STANDARD_PLANETS.filter((p) => p !== draft.lords[sign]).map((p) => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle icon={Grid3x3} title="มาตรฐานของแต่ละดาว" description="แตะช่องเพื่อเลือกราศี · ช่องที่ว่างไว้ ระบบและ AI จะไม่นับมาตรฐานนั้นให้ดาวดวงนั้น" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-[var(--surface)] px-2 py-2 text-left font-medium text-[var(--muted)]">ดาว</th>
                    {STANDARD_KINDS.map((k) => <th key={k} className={`px-2 py-2 text-left font-medium ${KIND_TONE[k]}`}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {STANDARD_PLANETS.map((planet) => (
                    <tr key={planet}>
                      <td className="sticky left-0 z-10 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-2 font-medium text-[var(--foreground)]">{planet}</td>
                      {STANDARD_KINDS.map((kind) => {
                        const signs = draft.planets[planet][kind];
                        const active = cell?.planet === planet && cell.kind === kind;
                        return (
                          <td key={kind} className="border-t border-[var(--border)] p-1 align-top">
                            <button
                              type="button"
                              onClick={() => setCell(active ? null : { planet, kind })}
                              aria-pressed={active}
                              aria-label={`${planet} ${kind}: ${signs.map((s) => SIGN_DISPLAY[s]).join(", ") || "ว่าง"}`}
                              className={`min-h-9 w-full rounded-lg px-2 py-1.5 text-left transition ${active ? "bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]" : "hover:bg-[var(--surface-2)]"}`}
                            >
                              {signs.length ? (
                                <span className="text-[var(--foreground)]">{signs.map((s) => SIGN_DISPLAY[s]).join(", ")}</span>
                              ) : (
                                <span className="text-[var(--muted-2)]">—</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cell && (
              <div className="mt-4 rounded-xl border border-[var(--primary)]/40 bg-[var(--surface-2)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[var(--foreground)]">
                    {cell.planet} · <span className={KIND_TONE[cell.kind]}>{cell.kind}</span> — เลือกได้หลายราศี
                  </p>
                  <Button variant="ghost" onClick={() => setCell(null)}>เสร็จ</Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STANDARD_SIGNS.map((sign) => {
                    const on = draft.planets[cell.planet][cell.kind].includes(sign);
                    return (
                      <button
                        key={sign}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleSign(cell.planet, cell.kind, sign)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "border-[var(--primary)] bg-[var(--primary)] font-medium text-[var(--background)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]/60 hover:text-[var(--foreground)]"}`}
                      >
                        {SIGN_DISPLAY[sign]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle icon={Bot} title="สิ่งที่ AI จะได้อ่าน" description="ส่งให้ AI ทุกคำถามในบล็อก [standards] พร้อมกฎว่าให้ยึดตารางนี้ ไม่ใช่ตำราอื่น" tone="blue" />
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-2)] p-3 text-[11px] leading-5 text-[var(--muted)]">{preview}</pre>
          </Card>

          <InfoBox>
            บันทึกแล้วมีผลภายใน 1 นาที ทั้งคำตอบใหม่และตารางดาวในหน้าแชท ความจำดวงของสมาชิกจะคำนวณใหม่เองในคำถามถัดไป ทุกการแก้บันทึกในประวัติแอดมิน
          </InfoBox>
        </div>
      )}
      <ConfirmDialog
        open={confirmReset}
        title="คืนค่าเริ่มต้น?"
        description="ตารางจะกลับเป็นค่าที่ระบบมีมาแต่แรก (ราหูเกษตรกุมภ์ เสาร์เจ้าเรือนเดิม และช่องเกณฑ์ว่าง) การแก้ของทีมจะหายไป แต่ยังดูย้อนได้ในประวัติแอดมิน"
        confirmLabel="คืนค่าเริ่มต้น"
        danger
        busy={busy}
        onConfirm={() => void save(true)}
        onCancel={() => setConfirmReset(false)}
      />
    </AdminPage>
  );
}
