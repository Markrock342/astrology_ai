import { CredentialsSignin } from "@auth/core/errors";
import { describe, expect, it, vi } from "vitest";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ signIn }));
const { signInCredentials } = await import("@/server/auth/server-sign-in");

describe("signInCredentials", () => {
  it("maps Auth.js's thrown CredentialsSignin to 'invalid' (was an uncaught 500)", async () => {
    signIn.mockRejectedValueOnce(new CredentialsSignin());
    await expect(signInCredentials("a@example.com", "pw-12345678")).resolves.toBe("invalid");
  });

  it("still throws anything else", async () => {
    signIn.mockRejectedValueOnce(new Error("db down"));
    await expect(signInCredentials("a@example.com", "pw-12345678")).rejects.toThrow("db down");
  });
});
