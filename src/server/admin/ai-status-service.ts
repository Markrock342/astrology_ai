import type { Prisma, UsageStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { generateWithFallback } from "@/server/ai/router";
import { classifyProviderFailure } from "@/server/ai/provider-alerts";

/** Hybrid Gemini status: Google Cloud incidents + our usage logs + on-demand health checks. */

const GOOGLE_INCIDENTS_URL = "https://status.cloud.google.com/incidents.json";
const GOOGLE_CACHE_TTL_MS = 5 * 60 * 1000;
const HEALTH_CACHE_TTL_MS = 15 * 60 * 1000;
const USAGE_PERIOD_DAYS = 7;
const RECENT_INCIDENTS_LIMIT = 8;

const AI_INCIDENT_KEYWORDS =
  /\bgemini\b|vertex ai|generative ai|cloud ai|ai platform|dialogflow cx/i;

type GoogleIncidentRaw = {
  id: string;
  begin?: string;
  end?: string | null;
  external_desc?: string;
  updates?: Array<{ when?: string; text?: string; status?: string }>;
};

export type GoogleIncidentSummary = {
  id: string;
  title: string;
  begin: string;
  end: string | null;
  status: "ongoing" | "resolved";
  latestUpdateAt: string | null;
  url: string;
};

export type ModelUsageHealth = {
  modelId: string;
  total7d: number;
  failures7d: number;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type ConfigHealthCheck = {
  configId: string;
  displayName: string;
  modelId: string;
  provider: string;
  ok: boolean;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  checkedAt: string;
};

export type AiStatusSnapshot = {
  google: {
    fetchedAt: string;
    cacheTtlSec: number;
    fetchError: string | null;
    activeIncidents: GoogleIncidentSummary[];
    recentIncidents: GoogleIncidentSummary[];
  };
  usage: {
    periodDays: number;
    byModel: ModelUsageHealth[];
    recentFailures: Array<{
      id: string;
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
    results: ConfigHealthCheck[];
  };
  /** Shared Gemini wallet/quota is failing — admin must top up or raise limits. */
  providerAlert: {
    kind: "BILLING" | "QUOTA" | "KEY";
    severity: "critical";
    title: string;
    message: string;
    since: string;
    sampleErrorCode: string | null;
    sampleErrorMessage: string | null;
    actionUrl: string;
  } | null;
};

let googleCache: { at: number; data: Omit<AiStatusSnapshot["google"], "fetchedAt" | "cacheTtlSec"> } | null =
  null;
let healthCache: { at: number; results: ConfigHealthCheck[] } | null = null;

function incidentMatchesAi(incident: GoogleIncidentRaw) {
  if (AI_INCIDENT_KEYWORDS.test(incident.external_desc ?? "")) return true;
  return (incident.updates ?? []).some((u) => AI_INCIDENT_KEYWORDS.test(u.text ?? ""));
}

function summarizeIncident(incident: GoogleIncidentRaw): GoogleIncidentSummary {
  const latest = incident.updates?.[0];
  const end = incident.end ?? null;
  const endMs = end ? Date.parse(end) : NaN;
  const resolvedByEnd = Number.isFinite(endMs) && endMs <= Date.now();
  const resolvedByStatus = latest?.status === "AVAILABLE";
  const status: GoogleIncidentSummary["status"] =
    resolvedByEnd || resolvedByStatus ? "resolved" : "ongoing";

  return {
    id: incident.id,
    title: (incident.external_desc ?? "Google Cloud incident").trim(),
    begin: incident.begin ?? incident.updates?.[0]?.when ?? new Date().toISOString(),
    end,
    status,
    latestUpdateAt: latest?.when ?? null,
    url: `https://status.cloud.google.com/incidents/${incident.id}`,
  };
}

async function fetchGoogleIncidents() {
  const now = Date.now();
  if (googleCache && now - googleCache.at < GOOGLE_CACHE_TTL_MS) {
    return googleCache.data;
  }

  try {
    const res = await fetch(GOOGLE_INCIDENTS_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = (await res.json()) as GoogleIncidentRaw[];
    const aiIncidents = raw.filter(incidentMatchesAi).map(summarizeIncident);
    aiIncidents.sort((a, b) => Date.parse(b.begin) - Date.parse(a.begin));

    const activeIncidents = aiIncidents.filter((i) => i.status === "ongoing");
    const recentIncidents = aiIncidents
      .filter((i) => i.status === "resolved")
      .slice(0, RECENT_INCIDENTS_LIMIT);

    const data = { fetchError: null as string | null, activeIncidents, recentIncidents };
    googleCache = { at: now, data };
    return data;
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    if (googleCache) {
      return { ...googleCache.data, fetchError: message };
    }
    return {
      fetchError: message,
      activeIncidents: [] as GoogleIncidentSummary[],
      recentIncidents: [] as GoogleIncidentSummary[],
    };
  }
}

async function getUsageHealth() {
  const since = new Date(Date.now() - USAGE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // A "failure" is a REAL system failure — not a user stopping their own answer
  // (logged as FAILED/STOPPED) and not an in-flight RESERVED slot. Counting
  // those alarmed the admin over things that never broke: the fail badge lit red
  // for a cancellation the user chose.
  const isRealFailure = {
    status: { in: ["FAILED", "TIMEOUT"] as UsageStatus[] },
    // Prisma's `not` includes NULLs, so a failure with no error code still counts.
    errorCode: { not: "STOPPED" },
  } satisfies Prisma.AIUsageLogWhereInput;

  const [totals, failureCounts, recentFailures] = await Promise.all([
    prisma.aIUsageLog.groupBy({
      by: ["modelId"],
      where: { createdAt: { gte: since }, provider: "GEMINI" },
      _count: { _all: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["modelId"],
      where: { createdAt: { gte: since }, provider: "GEMINI", ...isRealFailure },
      _count: { _all: true },
    }),
    prisma.aIUsageLog.findMany({
      where: { createdAt: { gte: since }, provider: "GEMINI", ...isRealFailure },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        modelId: true,
        status: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  const failureByModel = new Map(
    failureCounts.map((f) => [f.modelId, f._count._all]),
  );

  const byModelMap = new Map<string, ModelUsageHealth>();
  for (const row of totals) {
    byModelMap.set(row.modelId, {
      modelId: row.modelId,
      total7d: row._count._all,
      failures7d: failureByModel.get(row.modelId) ?? 0,
      lastFailureAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  }

  for (const fail of recentFailures) {
    const entry = byModelMap.get(fail.modelId);
    if (entry && !entry.lastFailureAt) {
      entry.lastFailureAt = fail.createdAt.toISOString();
      entry.lastErrorCode = fail.errorCode;
      entry.lastErrorMessage = fail.errorMessage;
    }
  }

  const byModel = [...byModelMap.values()].sort((a, b) => b.failures7d - a.failures7d);

  return {
    periodDays: USAGE_PERIOD_DAYS,
    byModel,
    recentFailures: recentFailures.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}

const HEALTH_PROMPT = {
  systemPrompt: "คุณคือผู้ช่วยทดสอบระบบ ตอบสั้นๆ 1 ประโยค",
  userPrompt: "ทดสอบการเชื่อมต่อ: ทักทายเป็นภาษาไทยสั้นๆ",
};

const HEALTH_CHECK_MAX_CONFIGS = 3;

export async function runConfigHealthChecks(force = false) {
  const now = Date.now();
  if (!force && healthCache && now - healthCache.at < HEALTH_CACHE_TTL_MS) {
    return {
      checkedAt: new Date(healthCache.at).toISOString(),
      stale: false,
      results: healthCache.results,
    };
  }

  const configs = await prisma.aIProviderConfig.findMany({
    where: { enabled: true },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
    take: HEALTH_CHECK_MAX_CONFIGS,
    select: { id: true, displayName: true, modelId: true, provider: true },
  });

  const checkedAt = new Date().toISOString();
  const results: ConfigHealthCheck[] = [];
  for (const cfg of configs) {
    try {
      const result = await generateWithFallback(cfg.id, HEALTH_PROMPT);
      results.push({
        configId: cfg.id,
        displayName: cfg.displayName,
        modelId: result.modelId || cfg.modelId,
        provider: cfg.provider,
        ok: result.ok,
        latencyMs: result.latencyMs ?? 0,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        checkedAt,
      });
    } catch (e) {
      results.push({
        configId: cfg.id,
        displayName: cfg.displayName,
        modelId: cfg.modelId,
        provider: cfg.provider,
        ok: false,
        latencyMs: 0,
        errorCode: "CHECK_FAILED",
        errorMessage: e instanceof Error ? e.message : "health check failed",
        checkedAt,
      });
    }
  }

  healthCache = { at: Date.now(), results };
  return { checkedAt, stale: false, results };
}

function getCachedHealth() {
  if (!healthCache) {
    return { checkedAt: null as string | null, stale: true, results: [] as ConfigHealthCheck[] };
  }
  const stale = Date.now() - healthCache.at > HEALTH_CACHE_TTL_MS;
  return {
    checkedAt: new Date(healthCache.at).toISOString(),
    stale,
    results: healthCache.results,
  };
}

async function getProviderAlert(): Promise<AiStatusSnapshot["providerAlert"]> {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000); // last 6 hours
  const failures = await prisma.aIUsageLog.findMany({
    where: {
      createdAt: { gte: since },
      provider: "GEMINI",
      status: { in: ["FAILED", "TIMEOUT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      errorCode: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  for (const fail of failures) {
    const kind = classifyProviderFailure(fail.errorCode, fail.errorMessage);
    if (!kind) continue;

    const titles = {
      BILLING: "เครดิต Gemini อาจหมด — แชททั้งระบบพังได้",
      QUOTA: "โควต้า Gemini เต็ม — คำขอถูกปฏิเสธ",
      KEY: "API key Gemini ใช้ไม่ได้",
    } as const;
    const messages = {
      BILLING:
        "พบ error แบบ billing/credits จาก Google ในช่วง 6 ชม.ที่ผ่านมา เติม Prepay ใน AI Studio ทันที แล้วตั้ง Budget alert ใน Cloud Billing",
      QUOTA:
        "พบ error โควต้า/rate-limit จาก Google — รอรีเซ็ตหรือขอเพิ่มโควต้าใน AI Studio",
      KEY: "ตรวจ GEMINI_API_KEY บน Vercel ว่าถูกต้องและยังใช้งานได้",
    } as const;

    return {
      kind,
      severity: "critical",
      title: titles[kind],
      message: messages[kind],
      since: fail.createdAt.toISOString(),
      sampleErrorCode: fail.errorCode,
      sampleErrorMessage: fail.errorMessage,
      actionUrl: "https://aistudio.google.com/plans",
    };
  }

  return null;
}

/** Combined status for GET /api/admin/ai-status. */
export async function getAiStatus() {
  const [google, usage, providerAlert] = await Promise.all([
    fetchGoogleIncidents(),
    getUsageHealth(),
    getProviderAlert(),
  ]);
  return {
    google: {
      fetchedAt: new Date().toISOString(),
      cacheTtlSec: GOOGLE_CACHE_TTL_MS / 1000,
      ...google,
    },
    usage,
    health: getCachedHealth(),
    providerAlert,
  } satisfies AiStatusSnapshot;
}

/** Lightweight poll for admin shell banner. */
export async function getProviderAlertOnly() {
  return getProviderAlert();
}
