import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { createReading } from "@/server/horoscope/reading-service";

const mocks = vi.hoisted(() => ({
  findReading: vi.fn(),
  findUser: vi.fn(),
  findCategory: vi.fn(),
  findWallet: vi.fn(),
  findProfile: vi.fn(),
  findKnowledge: vi.fn(),
  transaction: vi.fn(),
  getEffectivePlan: vi.fn(),
  assertCanRequestReading: vi.fn(),
  assertWithinUsageLimits: vi.fn(),
  reserveUsageSlot: vi.fn(),
  releaseUsageReservation: vi.fn(),
  resolveConfig: vi.fn(),
  resolvePromptParts: vi.fn(),
  loadChart: vi.fn(),
  requireReadyNatalChart: vi.fn(),
  getOrRefreshChartMemory: vi.fn(),
  getOrComputeDailyTransit: vi.fn(),
  questionWantsTodayTransit: vi.fn(() => false),
  generateWithFallback: vi.fn(),
  logUsage: vi.fn(),
  deductCredits: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    horoscopeReading: { findUnique: mocks.findReading },
    user: { findUnique: mocks.findUser },
    horoscopeCategory: { findUnique: mocks.findCategory },
    creditWallet: { findUnique: mocks.findWallet },
    birthProfile: { findUnique: mocks.findProfile },
    knowledgeDoc: { findMany: mocks.findKnowledge },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/user/account-service", () => ({
  getEffectivePlan: mocks.getEffectivePlan,
}));

// The free-tier rules live in access-policy and have their own suite; here we
// only assert that runReading honours its verdict.
vi.mock("@/server/horoscope/access-policy", () => ({
  assertCanRequestReading: mocks.assertCanRequestReading,
}));

vi.mock("@/server/credit/quota-service", () => ({
  assertWithinUsageLimits: mocks.assertWithinUsageLimits,
  reserveUsageSlot: mocks.reserveUsageSlot,
  releaseUsageReservation: mocks.releaseUsageReservation,
}));

vi.mock("@/server/ai/router", () => ({
  resolveConfig: mocks.resolveConfig,
  generateWithFallback: mocks.generateWithFallback,
}));

vi.mock("@/server/horoscope/prompt-resolver", () => ({
  resolvePromptParts: mocks.resolvePromptParts,
}));

vi.mock("@/server/horoscope/chart-context", () => ({
  loadChartForUser: mocks.loadChart,
  requireReadyNatalChart: mocks.requireReadyNatalChart,
  assertUsableEngineChart: (chart: unknown) => chart,
  isUsableEngineChart: (chart: unknown) => Boolean(chart),
}));

vi.mock("@/server/horoscope/chart-memory-service", () => ({
  getOrRefreshChartMemory: mocks.getOrRefreshChartMemory,
}));

vi.mock("@/server/horoscope/daily-transit-service", () => ({
  getOrComputeDailyTransit: mocks.getOrComputeDailyTransit,
  questionWantsTodayTransit: mocks.questionWantsTodayTransit,
}));
vi.mock("@/server/ai/usage-logger", () => ({
  logUsage: mocks.logUsage,
}));

vi.mock("@/server/credit/credit-service", () => ({
  deductCredits: mocks.deductCredits,
  lockWalletForUpdate: vi.fn().mockResolvedValue(undefined),
}));

const baseCategory = {
  id: "cat-1",
  slug: "career",
  enabled: true,
  accessLevel: "FREE",
  creditCost: 1,
  promptTemplateId: null,
  nameTh: "การงาน",
  description: "หมวดการงาน",
};

const baseProfile = {
  nickname: "ทดสอบ",
  birthDate: new Date("1990-01-15"),
  birthTime: "08:30",
  birthTimeKnown: true,
  gender: "หญิง",
  birthLocation: "กรุงเทพฯ",
  additionalInfo: null,
};

function setupHappyPath() {
  mocks.findReading.mockResolvedValue(null);
  mocks.findUser.mockResolvedValue({ id: "user-1", status: "ACTIVE" });
  mocks.findCategory.mockResolvedValue(baseCategory);
  mocks.getEffectivePlan.mockResolvedValue("PRO");
  mocks.findWallet.mockResolvedValue({ balance: 10 });
  mocks.assertWithinUsageLimits.mockResolvedValue(undefined);
  mocks.reserveUsageSlot.mockResolvedValue("reservation-1");
  mocks.releaseUsageReservation.mockResolvedValue(undefined);
  mocks.findProfile.mockResolvedValue(baseProfile);
  mocks.findKnowledge.mockResolvedValue([]);
  mocks.resolveConfig.mockResolvedValue({
    id: "cfg-1",
    promptTemplateId: null,
    provider: "GEMINI",
    modelId: "gemini-2.5-flash",
    maxOutputTokens: 2048,
  });
  mocks.resolvePromptParts.mockResolvedValue({
    safety: "safe",
    persona: "persona",
    plan: "plan",
    category: "cat",
    outputFormat: "fmt",
  });
  mocks.loadChart.mockResolvedValue(null);
  mocks.requireReadyNatalChart.mockResolvedValue({
    input: {
      day: 15,
      month: 1,
      year: 1990,
      time: "08:30",
      country: "ไทย",
      province: "กรุงเทพมหานคร",
      district: "พระนคร",
    },
    calculatedAt: new Date().toISOString(),
    settings: {
      calendar: "suryayat",
      ayanamsa: "lahiri",
      timeMethod: "antonathi_samrap_sunrise_local",
      rahuRule: "eight_signs_aquarius",
      taksaRahuLord: "mercury_night",
      taksaCountFrom: "center",
    },
    meta: {
      birthDisplay: "15/1/1990 08:30",
      locationDisplay: "พระนคร, กรุงเทพมหานคร",
      calculationSource: "formula-pipeline",
      lagna: "เมษ",
    },
    planets: [
      { planet: "อาทิตย์", siderealSign: "มกร", degreeText: "10°" },
      { planet: "จันทร์", siderealSign: "เมษ", degreeText: "5°" },
      { planet: "อังคาร", siderealSign: "พิจิก", degreeText: "12°" },
      { planet: "พุธ", siderealSign: "ธนู", degreeText: "3°" },
      { planet: "พฤหัสบดี", siderealSign: "มิถุน", degreeText: "8°" },
      { planet: "ศุกร์", siderealSign: "มกร", degreeText: "20°" },
      { planet: "เสาร์", siderealSign: "ธนู", degreeText: "15°" },
      { planet: "ราหู", siderealSign: "มกร", degreeText: "1°" },
      { planet: "เกตุ", siderealSign: "สิงห์", degreeText: "1°" },
      { planet: "มฤตยู", siderealSign: "ธนู", degreeText: "7°" },
    ],
    chart: { lagna: "เมษ", taksa: [] },
  });
  mocks.getOrRefreshChartMemory.mockResolvedValue({
    lagna: "เมษ",
    source: "formula-pipeline",
    birthHash: "abc",
    computedAt: new Date().toISOString(),
    taksa: [],
    houseOccupants: [],
    categories: {
      career: {
        houses: [10, 6, 2],
        planetsInHouses: [],
        houseLords: [],
        summaryLines: ["งาน/อาชีพ: เรือน 10, 6, 2 จากลัคนาเมษ"],
      },
      love: {
        houses: [7, 5],
        planetsInHouses: [],
        houseLords: [],
        summaryLines: ["ความรัก: เรือน 7, 5"],
      },
      money: {
        houses: [2, 11],
        planetsInHouses: [],
        houseLords: [],
        summaryLines: ["การเงิน: เรือน 2, 11"],
      },
      health: {
        houses: [1, 6, 8],
        planetsInHouses: [],
        houseLords: [],
        summaryLines: ["สุขภาพ: เรือน 1, 6, 8"],
      },
    },
  });
  mocks.questionWantsTodayTransit.mockReturnValue(false);
  mocks.generateWithFallback.mockResolvedValue({
    ok: true,
    rawText: "คำตอบจาก AI",
    provider: "GEMINI",
    modelId: "gemini-2.5-flash",
    latencyMs: 120,
    usage: { inputTokens: 10, outputTokens: 20 },
  });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      horoscopeReading: {
        create: vi.fn().mockResolvedValue({
          id: "reading-1",
          responseText: "คำตอบจาก AI",
          creditCost: 1,
          status: "SUCCESS",
          provider: "GEMINI",
          modelId: "gemini-2.5-flash",
        }),
      },
      aIUsageLog: {
        findFirst: vi.fn().mockResolvedValue({ id: "reservation-1" }),
        update: vi.fn().mockResolvedValue({ id: "reservation-1", status: "SUCCESS" }),
      },
    };
    return fn(tx);
  });
  mocks.deductCredits.mockResolvedValue({ balance: 9 });
  mocks.logUsage.mockResolvedValue(undefined);
}

describe("createReading (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanRequestReading.mockResolvedValue("PRO");
    setupHappyPath();
  });

  it("returns existing reading for duplicate idempotency key", async () => {
    const existing = { id: "reading-existing", responseText: "เดิม" };
    mocks.findReading.mockResolvedValue(existing);

    const result = await createReading({
      userId: "user-1",
      categorySlug: "career",
      question: "คำถาม",
      idempotencyKey: "key-1",
    });

    expect(result).toMatchObject({
      id: "reading-existing",
      responseText: "เดิม",
      transitSnapshot: null,
    });
    expect(mocks.generateWithFallback).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not call the AI when the access policy refuses the request", async () => {
    mocks.assertCanRequestReading.mockRejectedValue(
      new AppError("CATEGORY_LOCKED", "หมวดนี้สำหรับสมาชิก Pro"),
    );

    await expect(
      createReading({
        userId: "user-1",
        categorySlug: "love",
        question: "q",
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_LOCKED" } satisfies Partial<AppError>);

    expect(mocks.generateWithFallback).not.toHaveBeenCalled();
  });

  it("marks a threaded question as a follow-up so Free cannot chain turns for free", async () => {
    await createReading({
      userId: "user-1",
      categorySlug: "career",
      question: "แล้วปีหน้าล่ะ",
      priorMessages: [{ role: "USER", content: "ก่อนหน้า" }],
    });

    expect(mocks.assertCanRequestReading).toHaveBeenCalledWith(
      expect.objectContaining({ isFollowUp: true }),
    );
  });

  it("marks an opening question as not a follow-up", async () => {
    await createReading({
      userId: "user-1",
      categorySlug: "career",
      question: "q",
    });

    expect(mocks.assertCanRequestReading).toHaveBeenCalledWith(
      expect.objectContaining({ isFollowUp: false }),
    );
  });

  it("throws NO_QUOTA when wallet balance is too low", async () => {
    mocks.findWallet.mockResolvedValue({ balance: 0 });

    await expect(
      createReading({ userId: "user-1", categorySlug: "career", question: "q" }),
    ).rejects.toMatchObject({ code: "NO_QUOTA" });

    expect(mocks.generateWithFallback).not.toHaveBeenCalled();
  });

  it("throws AI_TIMEOUT and does not charge when AI times out", async () => {
    mocks.generateWithFallback.mockResolvedValue({
      ok: false,
      provider: "GEMINI",
      modelId: "gemini-2.5-flash",
      latencyMs: 30_000,
      errorCode: "TIMEOUT",
      errorMessage: "timed out",
    });

    await expect(
      createReading({ userId: "user-1", categorySlug: "career", question: "q" }),
    ).rejects.toMatchObject({ code: "AI_TIMEOUT" });

    expect(mocks.reserveUsageSlot).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", creditCost: 1 }),
    );
    expect(mocks.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TIMEOUT", userId: "user-1" }),
    );
    expect(mocks.releaseUsageReservation).toHaveBeenCalledWith("reservation-1");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deductCredits).not.toHaveBeenCalled();
  });

  it("deducts credits on successful AI response", async () => {
    const result = await createReading({
      userId: "user-1",
      categorySlug: "career",
      question: "เรื่องงานเป็นอย่างไร",
      idempotencyKey: "key-ok",
    });

    expect(result).toMatchObject({ id: "reading-1", responseText: "คำตอบจาก AI" });
    expect(mocks.generateWithFallback).toHaveBeenCalledOnce();
    const aiCall = mocks.generateWithFallback.mock.calls[0]?.[1] as {
      userPrompt: string;
      systemPrompt: string;
    };
    expect(aiCall.userPrompt).toContain("[natal]");
    expect(aiCall.userPrompt).toContain("[memory]");
    expect(aiCall.systemPrompt).toContain("กฎบังคับ");
    expect(mocks.reserveUsageSlot).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.deductCredits).toHaveBeenCalledWith(
      "user-1",
      1,
      expect.objectContaining({ type: "AI_USAGE", referenceType: "reading" }),
      expect.anything(),
    );
  });

  it("caps knowledge docs to the character budget in sortOrder", async () => {
    mocks.findKnowledge.mockResolvedValue([
      { title: "A", content: "a".repeat(2500), sortOrder: 1 },
      { title: "B", content: "b".repeat(2500), sortOrder: 2 },
    ]);

    await createReading({
      userId: "user-1",
      categorySlug: "career",
      question: "q",
    });

    const aiCall = mocks.generateWithFallback.mock.calls[0]?.[1] as {
      systemPrompt: string;
    };
    expect(aiCall.systemPrompt).toContain("## A");
    expect(aiCall.systemPrompt).not.toContain("## B");
    expect(aiCall.systemPrompt.length).toBeLessThanOrEqual(4_100);
  });

  it("passes plan-specific maxOutputTokens to the AI router", async () => {
    mocks.assertCanRequestReading.mockResolvedValue("FREE");

    await createReading({
      userId: "user-1",
      categorySlug: "career",
      question: "q",
    });

    const aiCall = mocks.generateWithFallback.mock.calls[0]?.[1] as {
      maxOutputTokens: number;
    };
    expect(aiCall.maxOutputTokens).toBe(1024);
  });
});
