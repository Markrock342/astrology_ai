import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  lastMessage: vi.fn(),
  lastReading: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    message: { findFirst: mocks.lastMessage },
    horoscopeReading: { findFirst: mocks.lastReading },
  },
}));
vi.mock("@/server/account/usage-service", () => ({ getMyUsage: vi.fn(async () => null) }));
vi.mock("@/server/admin/cost-admin-service", () => ({ getUserCost: vi.fn(async () => null) }));

import { getUserDetail } from "@/server/admin/user-admin-service";

const row = {
  id: "u1",
  name: "Somchai",
  email: "s@example.com",
  role: "USER",
  status: "ACTIVE",
  createdAt: new Date("2026-09-01T03:00:00Z"),
  updatedAt: new Date("2026-09-02T03:00:00Z"),
  image: "https://lh3.googleusercontent.com/a/photo",
  emailVerifiedAt: new Date("2026-09-01T03:05:00Z"),
  passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
  accounts: [{ provider: "google" }, { provider: "google" }],
  birthProfile: {
    id: "b1",
    nickname: "ชาย",
    gender: "ชาย",
    birthCountry: "ไทย",
    birthProvince: "ขอนแก่น",
    birthDistrict: "เมืองขอนแก่น",
    birthTimeKnown: false,
    editCount: 1,
    createdAt: new Date("2026-09-01T03:10:00Z"),
  },
  creditWallet: null,
  subscriptions: [],
  creditTxns: [],
};

describe("admin user detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue(row);
  });

  it("never sends the password hash to the admin page", async () => {
    mocks.lastMessage.mockResolvedValue(null);
    mocks.lastReading.mockResolvedValue(null);
    const detail = await getUserDetail("u1");
    const json = JSON.stringify(detail);
    expect(json).not.toContain("passwordHash");
    expect(json).not.toContain("$2b$");
    expect(detail.hasPassword).toBe(true);
    expect(detail.signInProviders).toEqual(["google"]);
  });

  it("uses the latest message or reading as last activity", async () => {
    mocks.lastMessage.mockResolvedValue({ createdAt: new Date("2026-09-20T10:00:00Z") });
    mocks.lastReading.mockResolvedValue({ createdAt: new Date("2026-09-22T10:00:00Z") });
    expect((await getUserDetail("u1")).lastActiveAt).toEqual(new Date("2026-09-22T10:00:00Z"));
  });

  it("says never when the person has not asked anything", async () => {
    mocks.lastMessage.mockResolvedValue(null);
    mocks.lastReading.mockResolvedValue(null);
    expect((await getUserDetail("u1")).lastActiveAt).toBeNull();
  });

  it("shows signup details but keeps the birth date behind the audited reveal", async () => {
    mocks.lastMessage.mockResolvedValue(null);
    mocks.lastReading.mockResolvedValue(null);
    const detail = await getUserDetail("u1");
    expect(detail.birthProfile).toMatchObject({
      gender: "ชาย",
      birthDistrict: "เมืองขอนแก่น",
      birthTimeKnown: false,
    });
    expect(JSON.stringify(detail)).not.toMatch(/birthDate|"birthTime"/);
  });
});
