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
  assertWithinUsageLimits: vi.fn(),
  resolveConfig: vi.fn(),
  resolvePromptParts: vi.fn(),
  loadChart: vi.fn(),
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

vi.mock("@/server/credit/quota-service", () => ({
  assertWithinUsageLimits: mocks.assertWithinUsageLimits,
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
}));

vi.mock("@/server/ai/usage-logger", () => ({
  logUsage: mocks.logUsage,
}));

vi.mock("@/server/credit/credit-service", () => ({
  deductCredits: mocks.deductCredits,
}));

const baseCategory = {
  id: "cat-1",
  slug: "career",
  enabled: true,
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
  mocks.findProfile.mockResolvedValue(baseProfile);
  mocks.findKnowledge.mockResolvedValue([]);
  mocks.resolveConfig.mockResolvedValue({ id: "cfg-1", promptTemplateId: null });
  mocks.resolvePromptParts.mockResolvedValue({
    safety: "safe",
    persona: "persona",
    plan: "plan",
    category: "cat",
    outputFormat: "fmt",
  });
  mocks.loadChart.mockResolvedValue(null);
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
    };
    return fn(tx);
  });
  mocks.deductCredits.mockResolvedValue({ balance: 9 });
  mocks.logUsage.mockResolvedValue(undefined);
}

describe("createReading (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(result).toBe(existing);
    expect(mocks.generateWithFallback).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("throws CHAT_REQUIRES_PRO for Free users", async () => {
    mocks.getEffectivePlan.mockResolvedValue("FREE");

    await expect(
      createReading({ userId: "user-1", categorySlug: "career", question: "q" }),
    ).rejects.toMatchObject({ code: "CHAT_REQUIRES_PRO" } satisfies Partial<AppError>);

    expect(mocks.generateWithFallback).not.toHaveBeenCalled();
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

    expect(mocks.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TIMEOUT", userId: "user-1" }),
    );
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
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.deductCredits).toHaveBeenCalledWith(
      "user-1",
      1,
      expect.objectContaining({ type: "AI_USAGE", referenceType: "reading" }),
      expect.anything(),
    );
  });
});
