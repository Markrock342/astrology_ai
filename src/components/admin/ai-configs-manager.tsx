"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_GEMINI_MODEL_ID,
  GEMINI_MODEL_PRESETS,
  geminiReplacementHint,
} from "@/config/gemini-models";
import {
  adminFetch,
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  InfoBox,
  PageHeader,
  Select,
  TextInput,
  Toggle,
} from "./ui";

type Category = { id: string; nameTh: string; slug: string };
type Prompt = { id: string; name: string; type: string; enabled: boolean };
type AIConfig = {
  id: string;
  provider: "GEMINI" | "OPENAI";
  modelId: string;
  displayName: string;
  secretReference: string;
  enabled: boolean;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  fallbackConfigId: string | null;
  planScope: "FREE" | "PRO" | "ALL";
  categoryId: string | null;
  promptTemplateId: string | null;
  notes: string | null;
};

type TestResult = {
  ok: boolean;
  modelId: string;
  latencyMs: number;
  reply: string | null;
  errorMessage: string | null;
};

type AiStatusSnapshot = {
  google: {
    fetchedAt: string;
    fetchError: string | null;
    activeIncidents: Array<{
      id: string;
      title: string;
      begin: string;
      status: "ongoing" | "resolved";
      url: string;
    }>;
    recentIncidents: Array<{
      id: string;
      title: string;
      begin: string;
      end: string | null;
      url: string;
    }>;
  };
  usage: {
    periodDays: number;
    byModel: Array<{
      modelId: string;
      total7d: number;
      failures7d: number;
      lastFailureAt: string | null;
      lastErrorCode: string | null;
    }>;
    recentFailures: Array<{
      modelId: string;
      status: string;
      errorCode: string | null;
      errorMessage: string | null;
      createdAt: string;
    }>;
  };
  health: {
    checkedAt: string | null;
    stale: boolean;
    results: Array<{
      configId: string;
      ok: boolean;
      latencyMs: number;
      errorCode: string | null;
      errorMessage: string | null;
    }>;
  };
  providerAlert: {
    kind: "BILLING" | "QUOTA" | "KEY";
    title: string;
    message: string;
    actionUrl: string;
    sampleErrorCode: string | null;
  } | null;
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const EMPTY_FORM = {
  provider: "GEMINI" as "GEMINI" | "OPENAI",
  modelId: DEFAULT_GEMINI_MODEL_ID,
  displayName: "",
  secretReference: "GEMINI_API_KEY",
  enabled: true,
  temperature: 0.7,
  maxOutputTokens: 2048,
  timeoutMs: 30000,
  fallbackConfigId: "",
  planScope: "ALL" as "FREE" | "PRO" | "ALL",
  categoryId: "",
  promptTemplateId: "",
  notes: "",
};

export function AiConfigsManager() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult | "loading">>({});
  const [status, setStatus] = useState<AiStatusSnapshot | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [healthRunning, setHealthRunning] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      setStatus(await adminFetch<AiStatusSnapshot>("/api/admin/ai-status"));
    } catch {
      // Status panel is supplementary — don't block the main page.
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgs, cats, ps] = await Promise.all([
        adminFetch<AIConfig[]>("/api/admin/ai-configs"),
        adminFetch<Category[]>("/api/admin/categories"),
        adminFetch<Prompt[]>("/api/admin/prompts"),
      ]);
      setConfigs(cfgs);
      setCategories(cats);
      setPrompts(ps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadStatus();
  }, [load, loadStatus]);

  async function runHealthChecks() {
    setHealthRunning(true);
    try {
      const health = await adminFetch<AiStatusSnapshot["health"]>(
        "/api/admin/ai-status/health",
        { method: "POST" },
      );
      setStatus((s) => (s ? { ...s, health } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตรวจสอบสุขภาพไม่สำเร็จ");
    } finally {
      setHealthRunning(false);
    }
  }

  function startEdit(cfg: AIConfig) {
    setEditingId(cfg.id);
    setForm({
      provider: cfg.provider,
      modelId: cfg.modelId,
      displayName: cfg.displayName,
      secretReference: cfg.secretReference,
      enabled: cfg.enabled,
      temperature: cfg.temperature,
      maxOutputTokens: cfg.maxOutputTokens,
      timeoutMs: cfg.timeoutMs,
      fallbackConfigId: cfg.fallbackConfigId ?? "",
      planScope: cfg.planScope,
      categoryId: cfg.categoryId ?? "",
      promptTemplateId: cfg.promptTemplateId ?? "",
      notes: cfg.notes ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        fallbackConfigId: form.fallbackConfigId || null,
        categoryId: form.categoryId || null,
        promptTemplateId: form.promptTemplateId || null,
        temperature: Number(form.temperature),
        maxOutputTokens: Number(form.maxOutputTokens),
        timeoutMs: Number(form.timeoutMs),
      };
      if (editingId) {
        await adminFetch(`/api/admin/ai-configs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/api/admin/ai-configs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("ลบ config นี้?")) return;
    try {
      await adminFetch(`/api/admin/ai-configs/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  async function toggleEnabled(cfg: AIConfig) {
    try {
      await adminFetch(`/api/admin/ai-configs/${cfg.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !cfg.enabled }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ");
    }
  }

  async function test(id: string) {
    setTestResults((r) => ({ ...r, [id]: "loading" }));
    try {
      const result = await adminFetch<TestResult>(`/api/admin/ai-configs/${id}/test`, {
        method: "POST",
      });
      setTestResults((r) => ({ ...r, [id]: result }));
    } catch (e) {
      setTestResults((r) => ({
        ...r,
        [id]: {
          ok: false,
          modelId: "",
          latencyMs: 0,
          reply: null,
          errorMessage: e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ",
        },
      }));
    }
  }

  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.nameTh ?? id) : "ทุกหมวด";
  const promptName = (id: string | null) =>
    id ? (prompts.find((p) => p.id === id)?.name ?? id) : "—";

  const usageByModel = new Map(status?.usage.byModel.map((m) => [m.modelId, m]) ?? []);
  const healthByConfig = new Map(status?.health.results.map((h) => [h.configId, h]) ?? []);
  const googleActive = status?.google.activeIncidents ?? [];
  const recentFailures = status?.usage.recentFailures ?? [];

  return (
    <AdminPage>
      <PageHeader
        title="AI Models"
        description="ตั้งค่าว่าหมวดไหน/แพลนไหนใช้โมเดลอะไร — API key อยู่ใน env เท่านั้น DB เก็บแค่ชื่อ secret"
        action={
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            + เพิ่ม Model Config
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">สถานะ Gemini / AI</h2>
            <p className="mt-1 text-[11px] text-[var(--muted-2)]">
              ชั้น 1: Google Cloud incidents · ชั้น 2: log ระบบเรา + health check · ชั้น 3: เตือน
              billing/quota
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void loadStatus()} disabled={statusLoading}>
              {statusLoading ? "กำลังโหลด…" : "รีเฟรช"}
            </Button>
            <Button onClick={() => void runHealthChecks()} disabled={healthRunning}>
              {healthRunning ? "กำลังตรวจ…" : "ตรวจการเชื่อมต่อ"}
            </Button>
          </div>
        </div>

        {status?.providerAlert ? (
          <div className="mt-3 rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-3 py-2">
            <p className="text-sm font-semibold text-[var(--danger)]">
              ⚠ {status.providerAlert.title}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{status.providerAlert.message}</p>
            <a
              href={status.providerAlert.actionUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-[var(--primary)] underline"
            >
              เปิด AI Studio Billing →
            </a>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div
            className={`rounded-lg border px-3 py-2 ${
              googleActive.length > 0
                ? "border-[var(--danger)]/40 bg-[var(--danger)]/5"
                : "border-[var(--secondary-active)]/30 bg-[var(--secondary-active)]/5"
            }`}
          >
            <p className="text-xs font-medium text-[var(--foreground)]">
              Google Cloud{" "}
              {googleActive.length > 0 ? (
                <Badge tone="red">มีเหตุการณ์ {googleActive.length} รายการ</Badge>
              ) : (
                <Badge tone="green">ไม่พบเหตุการณ์ที่กระทบ Gemini</Badge>
              )}
            </p>
            {status?.google.fetchError && (
              <p className="mt-1 text-[11px] text-[var(--danger)]">
                ดึงข้อมูล Google ไม่ได้: {status.google.fetchError}
              </p>
            )}
            {googleActive.map((inc) => (
              <p key={inc.id} className="mt-2 text-[11px] text-[var(--muted)]">
                <a
                  href={inc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {inc.title}
                </a>{" "}
                · เริ่ม {fmtWhen(inc.begin)}
              </p>
            ))}
            {(status?.google.recentIncidents.length ?? 0) > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-[var(--muted-2)]">
                  ประวัติเหตุการณ์ล่าสุด ({status?.google.recentIncidents.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {status?.google.recentIncidents.map((inc) => (
                    <li key={inc.id} className="text-[11px] text-[var(--muted-2)]">
                      <a
                        href={inc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primary)] hover:underline"
                      >
                        {inc.title.slice(0, 90)}
                        {inc.title.length > 90 ? "…" : ""}
                      </a>
                      {inc.end && <> · จบ {fmtWhen(inc.end)}</>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-2 text-[10px] text-[var(--muted-2)]">
              <a
                href="https://status.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                status.cloud.google.com
              </a>
              {status?.google.fetchedAt && <> · อัปเดต {fmtWhen(status.google.fetchedAt)}</>}
            </p>
          </div>

          <div className="rounded-lg border border-[var(--border)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--foreground)]">
              ระบบเรา ({status?.usage.periodDays ?? 7} วันล่าสุด)
            </p>
            {recentFailures.length === 0 ? (
              <p className="mt-2 text-[11px] text-[var(--secondary-active)]">
                ไม่มี error จริงจาก log Gemini ในช่วงนี้ (ผู้ใช้กดหยุดเองไม่นับ)
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {recentFailures.slice(0, 6).map((f, i) => (
                  <li
                    key={`${f.createdAt}-${i}`}
                    className="text-[11px] text-[var(--muted)]"
                  >
                    <details className="group/err">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5">
                        <Badge tone="red">{f.errorCode ?? f.status}</Badge>
                        <span className="truncate">{f.modelId}</span>
                        <span className="text-[var(--muted-2)]">
                          · {fmtWhen(f.createdAt)}
                        </span>
                        {f.errorMessage ? (
                          <span className="ml-auto text-[10px] text-[var(--primary)] group-open/err:hidden">
                            ดูสาเหตุ
                          </span>
                        ) : null}
                      </summary>
                      {f.errorMessage ? (
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--surface-2)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--foreground)]">
                          {f.errorMessage}
                        </pre>
                      ) : (
                        <p className="mt-1 text-[10px] text-[var(--muted-2)]">
                          ไม่มีรายละเอียดเพิ่มเติม (errorCode: {f.errorCode ?? "—"})
                        </p>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {status?.health.checkedAt ? (
              <p className="mt-2 text-[10px] text-[var(--muted-2)]">
                health check ล่าสุด {fmtWhen(status.health.checkedAt)}
                {status.health.stale ? " (ข้อมูลเก่า — กดตรวจการเชื่อมต่อ)" : ""}
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-[var(--muted-2)]">
                ยังไม่เคยรัน health check — กด &quot;ตรวจการเชื่อมต่อ&quot;
              </p>
            )}
          </div>
        </div>

        <InfoBox>
          เราใช้ Google AI Developer API (ไม่ใช่ Vertex) — สถานะ Google เป็นแนวโน้มเท่านั้น
          log และ health check ด้านล่างสะท้อนประสบการณ์จริงของแอปมากกว่า
        </InfoBox>
      </Card>

      {showForm && (
        <Card>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Provider">
              <Select
                value={form.provider}
                onChange={(e) =>
                  setForm({ ...form, provider: e.target.value as "GEMINI" | "OPENAI" })
                }
              >
                <option value="GEMINI">Gemini</option>
                <option value="OPENAI">OpenAI</option>
              </Select>
            </Field>
            <Field label="Model ID" hint="เลือกจากรายการ หรือพิมพ์เอง — Google ยกเลิก 2.5 แล้ว">
              <Select
                value={
                  GEMINI_MODEL_PRESETS.some((p) => p.id === form.modelId)
                    ? form.modelId
                    : "__custom__"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== "__custom__") setForm({ ...form, modelId: v });
                }}
                className="mb-2"
              >
                {GEMINI_MODEL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="__custom__">อื่น ๆ (พิมพ์เอง)</option>
              </Select>
              <TextInput
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                placeholder="gemini-3.5-flash"
              />
              {form.provider === "GEMINI" && geminiReplacementHint(form.modelId) && (
                <p className="mt-1 text-[10px] text-[var(--danger)]">
                  {geminiReplacementHint(form.modelId)}
                </p>
              )}
            </Field>
            <Field label="ชื่อที่แสดง">
              <TextInput
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="เช่น Free — Flash Lite"
              />
            </Field>
            <Field label="Secret (ชื่อ env var)" hint="เช่น GEMINI_API_KEY — ไม่ใช่ตัว key">
              <TextInput
                value={form.secretReference}
                onChange={(e) => setForm({ ...form, secretReference: e.target.value })}
              />
            </Field>
            <Field label="ใช้กับแพลน">
              <Select
                value={form.planScope}
                onChange={(e) =>
                  setForm({ ...form, planScope: e.target.value as "FREE" | "PRO" | "ALL" })
                }
              >
                <option value="ALL">ทุกแพลน</option>
                <option value="FREE">Free เท่านั้น</option>
                <option value="PRO">Pro เท่านั้น</option>
              </Select>
            </Field>
            <Field label="ใช้กับหมวด">
              <Select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">ทุกหมวด</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameTh}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prompt template">
              <Select
                value={form.promptTemplateId}
                onChange={(e) => setForm({ ...form, promptTemplateId: e.target.value })}
              >
                <option value="">ไม่ระบุ (ใช้ default)</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fallback config" hint="ใช้ตัวไหนแทนถ้าโมเดลนี้ล่ม">
              <Select
                value={form.fallbackConfigId}
                onChange={(e) => setForm({ ...form, fallbackConfigId: e.target.value })}
              >
                <option value="">ไม่มี</option>
                {configs
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Temperature (0-2)">
              <TextInput
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max output tokens">
              <TextInput
                type="number"
                min={64}
                value={form.maxOutputTokens}
                onChange={(e) =>
                  setForm({ ...form, maxOutputTokens: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Timeout (ms)">
              <TextInput
                type="number"
                min={1000}
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
              />
            </Field>
            <Field label="โน้ต">
              <TextInput
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Toggle
              checked={form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
              label="เปิดใช้งาน"
            />
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                ยกเลิก
              </Button>
              <Button onClick={save} disabled={busy || !form.modelId || !form.displayName}>
                {busy ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "สร้าง config"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading && !showForm ? (
        <div className="mt-4 flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
      <div className="mt-4 flex flex-col gap-3">
        {configs.map((cfg) => {
          const result = testResults[cfg.id];
          const usage = usageByModel.get(cfg.modelId);
          const health = healthByConfig.get(cfg.id);
          return (
            <Card key={cfg.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {cfg.displayName}
                </span>
                <Badge tone="gold">{cfg.provider}</Badge>
                <Badge>{cfg.modelId}</Badge>
                {health && (
                  <Badge tone={health.ok ? "green" : "red"}>
                    {health.ok ? `live OK ${health.latencyMs}ms` : "live ล้มเหลว"}
                  </Badge>
                )}
                {usage && usage.failures7d > 0 && (
                  <Badge tone="red">log {usage.failures7d}/{usage.total7d} fail</Badge>
                )}
                <Badge tone={cfg.planScope === "PRO" ? "gold" : cfg.planScope === "FREE" ? "green" : "muted"}>
                  {cfg.planScope === "ALL" ? "ทุกแพลน" : cfg.planScope}
                </Badge>
                <Badge>{catName(cfg.categoryId)}</Badge>
                {!cfg.enabled && <Badge tone="red">ปิดอยู่</Badge>}
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" onClick={() => test(cfg.id)}>
                    {result === "loading" ? "กำลังทดสอบ…" : "ทดสอบ"}
                  </Button>
                  <Button variant="ghost" onClick={() => toggleEnabled(cfg)}>
                    {cfg.enabled ? "ปิด" : "เปิด"}
                  </Button>
                  <Button variant="ghost" onClick={() => startEdit(cfg)}>
                    แก้ไข
                  </Button>
                  <Button variant="danger" onClick={() => remove(cfg.id)}>
                    ลบ
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[var(--muted-2)]">
                prompt: {promptName(cfg.promptTemplateId)} · temp {cfg.temperature} · max{" "}
                {cfg.maxOutputTokens} tok · timeout {cfg.timeoutMs / 1000}s · secret{" "}
                {cfg.secretReference}
              </p>
              {cfg.provider === "GEMINI" && geminiReplacementHint(cfg.modelId) && (
                <p className="mt-2 text-[11px] text-[var(--danger)]">
                  ⚠ {geminiReplacementHint(cfg.modelId)}
                </p>
              )}
              {result && result !== "loading" && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                    result.ok
                      ? "border-[var(--secondary-active)]/40 text-[var(--foreground)]"
                      : "border-[var(--danger)]/40 text-[var(--danger)]"
                  }`}
                >
                  {result.ok ? (
                    <>
                      <span className="text-[var(--secondary-active)]">
                        ผ่าน ({result.latencyMs} ms)
                      </span>{" "}
                      — {result.reply}
                    </>
                  ) : (
                    <>ล้มเหลว: {result.errorMessage}</>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {configs.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">ยังไม่มี config</p>
        )}
      </div>
      )}
    </AdminPage>
  );
}
