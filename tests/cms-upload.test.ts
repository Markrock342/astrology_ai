import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildCmsObjectPath,
  extensionForMime,
  mediaPublicPath,
  uploadCmsImage,
} from "@/server/storage/cms-upload";
import { AppError } from "@/lib/errors";

vi.mock("@/server/db", () => ({
  prisma: {
    mediaAsset: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";

describe("cms-upload helpers", () => {
  it("maps mime to extension", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
  });

  it("rejects unsupported mime for extension", () => {
    expect(() => extensionForMime("image/gif")).toThrow(AppError);
  });

  it("builds object path under cms/{adminId}/", () => {
    const path = buildCmsObjectPath({
      adminId: "admin_1",
      contentType: "image/png",
      nowMs: 1_700_000_000_000,
    });
    expect(path).toBe("cms/admin_1/1700000000000.png");
  });

  it("rejects bad mime when building path", () => {
    expect(() =>
      buildCmsObjectPath({
        adminId: "a",
        contentType: "application/pdf",
      }),
    ).toThrow(AppError);
  });

  it("mediaPublicPath is relative (host-agnostic)", () => {
    expect(mediaPublicPath("abc123")).toBe("/api/media/abc123");
  });
});

describe("uploadCmsImage", () => {
  beforeEach(() => {
    vi.mocked(prisma.mediaAsset.create).mockReset();
  });

  it("persists bytes and returns /api/media/:id", async () => {
    vi.mocked(prisma.mediaAsset.create).mockResolvedValue({
      id: "media_xyz",
    } as never);

    const result = await uploadCmsImage({
      bytes: new Uint8Array([1, 2, 3, 4]),
      contentType: "image/png",
      uploadedById: "admin_1",
    });

    expect(result).toEqual({ id: "media_xyz", url: "/api/media/media_xyz" });
    expect(prisma.mediaAsset.create).toHaveBeenCalledOnce();
    const arg = vi.mocked(prisma.mediaAsset.create).mock.calls[0]![0];
    expect(arg.data.contentType).toBe("image/png");
    expect(arg.data.byteSize).toBe(4);
    expect(arg.data.uploadedById).toBe("admin_1");
  });

  it("rejects non-image mime", async () => {
    await expect(
      uploadCmsImage({
        bytes: new Uint8Array([1]),
        contentType: "text/plain",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it("rejects empty / oversized payloads", async () => {
    await expect(
      uploadCmsImage({
        bytes: new Uint8Array([]),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
