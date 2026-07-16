"use client";

import { useCallback, useEffect, useState } from "react";
import { providerLabel, type SupportedAIProvider } from "@/config/ai-provider-models";
import { geminiReplacementHint } from "@/config/gemini-models";
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
  provider: SupportedAIProvider;
  modelId: string;
  displayName: string;
  baseUrl: string | null;
  secretReference: string | null;
  keyLast4: string | null;
  hasStoredKey: boolean;
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
  provider?: SupportedAIProvider;
  modelId: string;
  latencyMs: number;
  reply: string | null;
  errorCode?: string | null;
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
      displayName: string;
      modelId: string;
      provider: SupportedAIProvider;
      ok: boolean;
      latencyMs: number;
      errorCode: string | null;
      errorMessage: string | null;
      checkedAt: string;
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
  provider: "GEMINI" as SupportedAIProvider,
  modelId: "",
  displayName: "",
  baseUrl: "",
  secretReference: "",
  apiKey: "",
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
  /** When editing: false = keep existing stored key; true = show input to replace. */
  const [replaceKey, setReplaceKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<
    { ok: boolean; message: string } | "loading" | null
  >(null);
  const [editingKeyLast4, setEditingKeyLast4] = useState<string | null>(null);
  const [editingHasStoredKey, setEditingHasStoredKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showLegacyEnv, setShowLegacyEnv] = useState(false);

  function setProvider(provider: SupportedAIProvider) {
    setKeyTestResult(null);
    setForm((current) => ({
      ...current,
      provider,
      // Keep what the admin already typed; only clear Base URL when leaving OpenAI.
      baseUrl: provider === "OPENAI" ? current.baseUrl : "",
      secretReference: "",
    }));
  }

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

  function setHealthSnapshot(
    checkedAt: string,
    results: AiStatusSnapshot["health"]["results"],
  ) {
    setStatus((s) => ({
      google: s?.google ?? {
        fetchedAt: new Date().toISOString(),
        fetchError: null,
        activeIncidents: [],
        recentIncidents: [],
      },
      usage: s?.usage ?? { periodDays: 7, byModel: [], recentFailures: [] },
      providerAlert: s?.providerAlert ?? null,
      health: { checkedAt, stale: false, results },
    }));
  }

  function upsertHealthResult(result: AiStatusSnapshot["health"]["results"][number]) {
    setStatus((s) => {
      const currentResults = s?.health.results ?? [];
      const nextResults = [
        ...currentResults.filter((item) => item.configId !== result.configId),
        result,
      ];
      return {
        google: s?.google ?? {
          fetchedAt: new Date().toISOString(),
          fetchError: null,
          activeIncidents: [],
          recentIncidents: [],
        },
        usage: s?.usage ?? { periodDays: 7, byModel: [], recentFailures: [] },
        providerAlert: s?.providerAlert ?? null,
        health: { checkedAt: result.checkedAt, stale: false, results: nextResults },
      };
    });
  }

  async function runHealthChecks() {
    setHealthRunning(true);
    setError(null);
    try {
      const snapshot = await adminFetch<AiStatusSnapshot["health"]>(
        "/api/admin/ai-status/health",
        { method: "POST", timeoutMs: 120_000 },
      );
      setHealthSnapshot(snapshot.checkedAt ?? new Date().toISOString(), snapshot.results);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตรวจสอบสุขภาพไม่สำเร็จ");
    } finally {
      setHealthRunning(false);
    }
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setReplaceKey(false);
    setKeyTestResult(null);
    setEditingKeyLast4(null);
    setEditingHasStoredKey(false);
    setAdvancedOpen(false);
    setShowLegacyEnv(false);
  }

  function startEdit(cfg: AIConfig) {
    setEditingId(cfg.id);
    setReplaceKey(false);
    setKeyTestResult(null);
    setEditingKeyLast4(cfg.keyLast4);
    setEditingHasStoredKey(cfg.hasStoredKey);
    setAdvancedOpen(false);
    setShowLegacyEnv(Boolean(cfg.secretReference));
    setForm({
      provider: cfg.provider,
      modelId: cfg.modelId,
      displayName: cfg.displayName,
      baseUrl: cfg.baseUrl ?? "",
      secretReference: cfg.secretReference ?? "",
      apiKey: "",
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

  function startCreate() {
    setEditingId(null);
    setReplaceKey(true);
    setKeyTestResult(null);
    setEditingKeyLast4(null);
    setEditingHasStoredKey(false);
    setAdvancedOpen(false);
    setShowLegacyEnv(false);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function testRawKey() {
    if (!form.apiKey.trim()) {
      setKeyTestResult({ ok: false, message: "กรุณาวาง API key ก่อนทดสอบ" });
      return;
    }
    setKeyTestResult("loading");
    try {
      const result = await adminFetch<{
        ok: boolean;
        latencyMs: number;
        errorMessage: string | null;
        preview: string | null;
      }>("/api/admin/ai-configs/test-key", {
        method: "POST",
        body: JSON.stringify({
          provider: form.provider,
          modelId: form.modelId,
          baseUrl: form.baseUrl || null,
          apiKey: form.apiKey,
        }),
      });
      setKeyTestResult({
        ok: result.ok,
        message: result.ok
          ? `ใช้ได้ (${result.latencyMs}ms)${result.preview ? ` — ${result.preview}` : ""}`
          : result.errorMessage ?? "ทดสอบไม่สำเร็จ",
      });
    } catch (e) {
      setKeyTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ",
      });
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const creating = !editingId;
      if (creating && !form.apiKey.trim()) {
        throw new Error("กรุณาวาง API key ก่อนสร้างโมเดล");
      }
      if (editingId && replaceKey && !form.apiKey.trim() && !editingHasStoredKey) {
        throw new Error("กรุณาวาง API key หรือยกเลิกการเปลี่ยน key");
      }
      const payload: Record<string, unknown> = {
        provider: form.provider,
        modelId: form.modelId,
        displayName: form.displayName,
        baseUrl: form.provider === "OPENAI" ? form.baseUrl || null : null,
        enabled: form.enabled,
        planScope: form.planScope,
        fallbackConfigId: form.fallbackConfigId || null,
        categoryId: form.categoryId || null,
        promptTemplateId: form.promptTemplateId || null,
        temperature: Number(form.temperature),
        maxOutputTokens: Number(form.maxOutputTokens),
        timeoutMs: Number(form.timeoutMs),
        notes: form.notes || undefined,
      };
      // Only send apiKey when creating or explicitly replacing.
      if ((!editingId || replaceKey) && form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }
      // Legacy env fallback is opt-in and never required for new configs.
      if (showLegacyEnv && form.secretReference.trim() && !(creating || (replaceKey && form.apiKey.trim()))) {
        payload.secretReference = form.secretReference.trim();
      } else if (creating || (replaceKey && form.apiKey.trim())) {
        payload.secretReference = null;
      }
      let savedId = editingId;
      if (editingId) {
        await adminFetch(`/api/admin/ai-configs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const created = await adminFetch<{ id: string }>("/api/admin/ai-configs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        savedId = created.id;
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setReplaceKey(false);
      setKeyTestResult(null);
      setAdvancedOpen(false);
      setShowLegacyEnv(false);
      await load();
      if (savedId) {
        setHighlightId(savedId);
        requestAnimationFrame(() => {
          document
            .getElementById(`ai-config-row-${savedId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
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
    const cfg = configs.find((item) => item.id === id);
    setTestResults((r) => ({ ...r, [id]: "loading" }));
    try {
      const result = await adminFetch<TestResult>(`/api/admin/ai-configs/${id}/test`, {
        method: "POST",
        timeoutMs: 45_000,
        body: JSON.stringify({ timeoutMs: 30_000 }),
      });
      setTestResults((r) => ({ ...r, [id]: result }));
      if (cfg) {
        upsertHealthResult({
          configId: cfg.id,
          displayName: cfg.displayName,
          modelId: result.modelId || cfg.modelId,
          provider: result.provider ?? cfg.provider,
          ok: result.ok,
          latencyMs: result.latencyMs,
          errorCode: result.errorCode ?? null,
          errorMessage: result.errorMessage ?? null,
          checkedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setTestResults((r) => ({
        ...r,
        [id]: {
          ok: false,
          modelId: "",
          latencyMs: 0,
          reply: null,
          errorCode: "CHECK_FAILED",
          errorMessage: e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ",
        },
      }));
      if (cfg) {
        upsertHealthResult({
          configId: cfg.id,
          displayName: cfg.displayName,
          modelId: cfg.modelId,
          provider: cfg.provider,
          ok: false,
          latencyMs: 0,
          errorCode: "CHECK_FAILED",
          errorMessage: e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ",
          checkedAt: new Date().toISOString(),
        });
      }
    }
  }

  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.nameTh ?? id) : "ทุกหมวด";

  const usageByModel = new Map(status?.usage.byModel.map((m) => [m.modelId, m]) ?? []);
  const healthByConfig = new Map(status?.health.results.map((h) => [h.configId, h]) ?? []);
  const googleActive = status?.google.activeIncidents ?? [];
  const recentFailures = status?.usage.recentFailures ?? [];

  return (
    <AdminPage>
      <PageHeader
        title="AI Models"
        description="ตั้งค่าว่าหมวดไหน/แพลนไหนใช้โมเดลอะไร — วาง API key ที่นี่ (เข้ารหัสใน DB). เลือก OpenAI-compatible เพื่อใช้ GPT / Cursor Composer"
        action={
          <Button onClick={startCreate}>
            + เพิ่ม Model Config
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              สถานะการเชื่อมต่อ AI
            </h2>
            <p className="mt-1 text-[11px] text-[var(--muted-2)]">
              ตรวจโมเดลที่เปิดใช้งานจริงทุกตัว · แสดงผลรายโมเดลในตารางด้านล่าง · ใช้ token
              เล็กน้อยต่อการทดสอบ
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
        {healthRunning && (
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            กำลังยิงทดสอบจริงไปยังโมเดลที่เปิดใช้ (primary เท่านั้น ไม่ผ่าน fallback) —
            ผลจะขึ้นในตารางด้านล่าง
          </p>
        )}
        {status?.health.results && status.health.results.length > 0 && !healthRunning && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {status.health.results.map((h) => (
              <li key={h.configId}>
                <Badge tone={h.ok ? "green" : "red"}>
                  {h.ok
                    ? `${h.displayName} OK ${h.latencyMs}ms`
                    : `${h.displayName} ล้มเหลว${h.errorCode ? ` (${h.errorCode})` : ""}`}
                </Badge>
              </li>
            ))}
          </ul>
        )}

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
                ไม่มี error จริงจาก log ระบบในช่วงนี้ (ผู้ใช้กดหยุดเองไม่นับ)
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
          Google Cloud status เป็นสัญญาณประกอบสำหรับ Gemini เท่านั้น ส่วนผล health check
          และปุ่มทดสอบในตารางคือการยิง API จริงของ config ที่เราใช้งานอยู่
        </InfoBox>
      </Card>

      {showForm && (
        <div className="mb-4 rounded-xl border-2 border-[var(--primary)]/40 bg-[var(--surface)] p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {editingId
                  ? `แก้ไข: ${form.displayName || "โมเดล"}`
                  : "เพิ่มโมเดลใหม่"}
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">
                กรอกเองทั้งหมด — เลือกโปรโตคอลแล้วพิมพ์ Model ID / ชื่อ / API key
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={cancelForm}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => void save()}
                disabled={
                  busy ||
                  !form.modelId ||
                  !form.displayName ||
                  (!editingId && !form.apiKey.trim())
                }
              >
                {busy ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "สร้าง config"}
              </Button>
            </div>
          </div>

          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-2)]">
              A · ตัวตนโมเดล
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <Field
                label="โปรโตคอล API (เจ้าของ)"
                hint="เลือกวิธีเรียก API จริง: Gemini หรือ OpenAI-compatible"
              >
                <Select
                  value={form.provider}
                  onChange={(e) => setProvider(e.target.value as SupportedAIProvider)}
                >
                  <option value="GEMINI">Gemini</option>
                  <option value="OPENAI">OpenAI-compatible</option>
                </Select>
              </Field>
              {form.provider === "OPENAI" && (
                <Field
                  label="Base URL"
                  hint="ที่อยู่ API ของเจ้าที่ใช้อยู่ — ว่างได้ถ้าเป็น OpenAI ทางการ"
                >
                  <TextInput
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  />
                </Field>
              )}
              <Field label="Model ID" hint="ชื่อโมเดลตามที่ provider กำหนด">
                <TextInput
                  value={form.modelId}
                  onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                />
                {form.provider === "GEMINI" && geminiReplacementHint(form.modelId) && (
                  <p className="mt-1 text-[10px] text-[var(--danger)]">
                    {geminiReplacementHint(form.modelId)}
                  </p>
                )}
              </Field>
              <Field label="ชื่อที่แสดง" hint="ชื่อที่แอดมินเห็นในตาราง">
                <TextInput
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Toggle
                checked={form.enabled}
                onChange={(v) => setForm({ ...form, enabled: v })}
                label="เปิดใช้งาน"
              />
            </div>
          </section>

          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-2)]">
              B · API key
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="API Key"
                hint={
                  editingId && editingHasStoredKey && !replaceKey
                    ? `บันทึกไว้แล้ว: ••••${editingKeyLast4 ?? "????"} — กดเปลี่ยนเพื่อวาง key ใหม่`
                    : `วาง key สำหรับ ${providerLabel(form.provider)} — จะถูกเข้ารหัสก่อนเก็บในระบบ (ไม่โชว์เต็มอีก)`
                }
              >
                {editingId && editingHasStoredKey && !replaceKey ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--muted)]">
                      ••••{editingKeyLast4 ?? "????"}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setReplaceKey(true);
                        setKeyTestResult(null);
                      }}
                    >
                      เปลี่ยน key
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <TextInput
                      type="password"
                      autoComplete="off"
                      value={form.apiKey}
                      onChange={(e) => {
                        setForm({ ...form, apiKey: e.target.value });
                        setKeyTestResult(null);
                      }}
                      placeholder="วาง API key ที่นี่"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        disabled={!form.apiKey.trim() || keyTestResult === "loading"}
                        onClick={() => void testRawKey()}
                      >
                        {keyTestResult === "loading" ? "กำลังทดสอบ…" : "ทดสอบ key"}
                      </Button>
                      {editingId && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setReplaceKey(false);
                            setForm({ ...form, apiKey: "" });
                            setKeyTestResult(null);
                          }}
                        >
                          ยกเลิกเปลี่ยน
                        </Button>
                      )}
                      {keyTestResult && keyTestResult !== "loading" && (
                        <span
                          className={`text-xs ${keyTestResult.ok ? "text-[var(--secondary-active)]" : "text-[var(--danger)]"}`}
                        >
                          {keyTestResult.message}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Field>
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted-2)]">
              คีย์หลักเก็บเข้ารหัสใน DB — ไม่ใช้ชื่อตัวแปร env ในฟอร์มสร้างโมเดลใหม่
              {editingId && form.secretReference
                ? ` (legacy env ที่เหลือ: ${form.secretReference})`
                : ""}
            </p>
            {(editingId || showLegacyEnv) && (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-[11px] text-[var(--primary)] hover:underline"
                  onClick={() => setShowLegacyEnv((v) => !v)}
                >
                  {showLegacyEnv ? "ซ่อน" : "แสดง"} ตัวเลือก legacy env fallback
                </button>
                {showLegacyEnv && (
                  <Field
                    label="Env fallback (ชื่อตัวแปร)"
                    hint="เฉพาะ rollback ชั่วคราว — ค่าที่อนุญาต: GEMINI_API_KEY หรือ OPENAI_API_KEY"
                  >
                    <TextInput
                      value={form.secretReference}
                      onChange={(e) => setForm({ ...form, secretReference: e.target.value })}
                      placeholder="GEMINI_API_KEY หรือ OPENAI_API_KEY"
                    />
                  </Field>
                )}
              </div>
            )}
          </section>

          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-2)]">
              C · ขอบเขตแพลน / หมวด
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
            </div>
          </section>

          <section>
            <button
              type="button"
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary)] hover:underline"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              D · พารามิเตอร์ขั้นสูง {advancedOpen ? "▾" : "▸"}
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
            )}
          </section>
        </div>
      )}

      {loading && !showForm ? (
        <div className="mt-4 flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] uppercase tracking-wide text-[var(--muted-2)]">
                <th className="px-3 py-2 font-medium">ชื่อ</th>
                <th className="px-3 py-2 font-medium">Provider / Model</th>
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium text-right">การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg) => {
                const result = testResults[cfg.id];
                const usage = usageByModel.get(cfg.modelId);
                const health = healthByConfig.get(cfg.id);
                const selected = showForm && editingId === cfg.id;
                const highlighted = highlightId === cfg.id;
                return (
                  <tr
                    id={`ai-config-row-${cfg.id}`}
                    key={cfg.id}
                    className={`border-b border-[var(--border)] last:border-0 ${
                      selected || highlighted
                        ? "bg-[var(--primary)]/8 ring-1 ring-inset ring-[var(--primary)]/30"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-[var(--foreground)]">{cfg.displayName}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted-2)]">
                        {cfg.planScope === "ALL" ? "ทุกแพลน" : cfg.planScope} · {catName(cfg.categoryId)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone="gold">{providerLabel(cfg.provider)}</Badge>
                        <Badge>{cfg.modelId}</Badge>
                      </div>
                      {cfg.provider === "OPENAI" && (
                        <p className="mt-1 text-[10px] text-[var(--muted-2)]">
                          {cfg.baseUrl ? cfg.baseUrl : "OpenAI default endpoint"}
                        </p>
                      )}
                      {cfg.provider === "GEMINI" && geminiReplacementHint(cfg.modelId) && (
                        <p className="mt-1 text-[10px] text-[var(--danger)]">
                          {geminiReplacementHint(cfg.modelId)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {cfg.hasStoredKey ? (
                        <Badge tone="green">••••{cfg.keyLast4 ?? "????"}</Badge>
                      ) : cfg.secretReference ? (
                        <Badge tone="muted">env {cfg.secretReference}</Badge>
                      ) : (
                        <Badge tone="red">ไม่มี key</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {!cfg.enabled && <Badge tone="red">ปิดอยู่</Badge>}
                        {cfg.enabled && <Badge tone="green">เปิด</Badge>}
                        {health && (
                          <Badge tone={health.ok ? "green" : "red"}>
                            {health.ok
                              ? `เชื่อมต่อได้ ${health.latencyMs}ms`
                              : `เชื่อมต่อไม่ได้${health.errorCode ? ` (${health.errorCode})` : ""}`}
                          </Badge>
                        )}
                        {cfg.enabled && !health && (
                          <Badge tone="muted">
                            {healthRunning ? "รอตรวจ" : "ยังไม่ตรวจ"}
                          </Badge>
                        )}
                        {usage && usage.failures7d > 0 && (
                          <Badge tone="red">
                            log {usage.failures7d}/{usage.total7d}
                          </Badge>
                        )}
                      </div>
                      {result && result !== "loading" && (
                        <p
                          className={`mt-1 text-[10px] ${
                            result.ok ? "text-[var(--secondary-active)]" : "text-[var(--danger)]"
                          }`}
                        >
                          {result.ok
                            ? `ทดสอบผ่าน (${result.latencyMs}ms)`
                            : `ทดสอบล้ม: ${result.errorCode ? `${result.errorCode} — ` : ""}${result.errorMessage}`}
                        </p>
                      )}
                      {health && !health.ok && health.errorMessage && (
                        <p className="mt-1 text-[10px] text-[var(--danger)]">
                          {health.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => void test(cfg.id)}
                          disabled={result === "loading"}
                        >
                          {result === "loading" ? "กำลังทดสอบ…" : "ทดสอบ"}
                        </Button>
                        <Button variant="ghost" onClick={() => void toggleEnabled(cfg)}>
                          {cfg.enabled ? "ปิด" : "เปิด"}
                        </Button>
                        <Button variant="ghost" onClick={() => startEdit(cfg)}>
                          แก้ไข
                        </Button>
                        <Button variant="danger" onClick={() => void remove(cfg.id)}>
                          ลบ
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {configs.length === 0 && (
            <p className="px-3 py-6 text-sm text-[var(--muted-2)]">ยังไม่มี config</p>
          )}
        </div>
      )}
    </AdminPage>
  );
}
