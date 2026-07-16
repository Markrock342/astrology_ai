import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMS_DEFAULTS, CMS_KEYS } from "@/lib/cms-keys";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/server/cms/preview-mode", () => ({
  isPreviewMode: vi.fn(async () => false),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    appSetting: {
      findUnique: vi.fn(),
    },
    faqItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { getSessionOrNull } from "@/server/auth/session";
import {
  getDraftSetting,
  getPublishedSetting,
} from "@/server/settings/settings-service";

describe("CMS soft-fail when DB is unreachable", () => {
  beforeEach(() => {
    vi.mocked(prisma.appSetting.findUnique).mockReset();
  });

  it("getPublishedSetting returns CMS_DEFAULTS when Prisma throws", async () => {
    vi.mocked(prisma.appSetting.findUnique).mockRejectedValue(
      new Error("Can't reach database server at localhost:5432"),
    );

    const value = await getPublishedSetting(CMS_KEYS.landingHero);
    expect(value).toEqual(CMS_DEFAULTS[CMS_KEYS.landingHero]);
  });

  it("getDraftSetting falls back to published/default when draft read fails", async () => {
    vi.mocked(prisma.appSetting.findUnique).mockRejectedValue(
      new Error("PrismaClientInitializationError"),
    );

    const value = await getDraftSetting(CMS_KEYS.siteFooter);
    expect(value).toEqual(CMS_DEFAULTS[CMS_KEYS.siteFooter]);
  });
});

describe("getSessionOrNull", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns null when auth throws (stale JWT / decrypt failure)", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("no matching decryption secret"));
    await expect(getSessionOrNull()).resolves.toBeNull();
  });

  it("returns the session when auth succeeds", async () => {
    const session = { user: { id: "u1" } };
    vi.mocked(auth).mockResolvedValue(session as never);
    await expect(getSessionOrNull()).resolves.toEqual(session);
  });
});
