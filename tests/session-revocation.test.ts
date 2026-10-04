import { beforeEach, describe, expect, it, vi } from "vitest";
import { credentialVersion } from "@/server/auth/credential-version";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/server/auth/admin-2fa-service", () => ({ assertAdmin2faVerified: vi.fn() }));

import { requireUser } from "@/server/auth/rbac";

const row = (passwordHash: string | null) => ({ id: "u1", role: "USER", status: "ACTIVE", email: "a@x", name: null, passwordHash });

describe("sessions after a password change", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a session from before the change is signed out", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", cv: credentialVersion("$old") } });
    mocks.findUnique.mockResolvedValue(row("$new"));
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("a session with the current password keeps working", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", cv: credentialVersion("$new") } });
    mocks.findUnique.mockResolvedValue(row("$new"));
    await expect(requireUser()).resolves.toMatchObject({ id: "u1" });
  });

  it("a token issued before fingerprints existed still works", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1" } });
    mocks.findUnique.mockResolvedValue(row("$new"));
    await expect(requireUser()).resolves.toMatchObject({ id: "u1" });
  });

  it("never returns the password hash", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", cv: credentialVersion("$new") } });
    mocks.findUnique.mockResolvedValue(row("$new"));
    expect(await requireUser()).not.toHaveProperty("passwordHash");
  });
});
