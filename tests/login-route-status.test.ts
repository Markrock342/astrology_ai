import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryRateLimitForTests } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => ({ findUser: vi.fn(), signIn: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: { user: { findUnique: mocks.findUser } } }));
vi.mock("@/server/auth/server-sign-in", () => ({ signInCredentials: mocks.signIn }));

const { POST } = await import("@/app/api/auth/login/route");

const HASH = bcrypt.hashSync("correct-horse-1", 4);
let ip = 0;
function login(email: string, password: string, from = `10.0.0.${++ip}`) {
  return POST(
    new Request("http://x/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": from },
      body: JSON.stringify({ email, password }),
    }),
  );
}

describe("POST /api/auth/login status codes", () => {
  beforeEach(() => {
    resetMemoryRateLimitForTests();
    mocks.findUser.mockReset().mockResolvedValue({ id: "u1", passwordHash: HASH, status: "ACTIVE" });
    mocks.signIn.mockReset().mockResolvedValue("ok");
  });

  it("200 on the right password", async () => {
    const res = await login("a@example.com", "correct-horse-1");
    expect(res.status).toBe(200);
  });

  it("401 on a wrong password and on an unknown email, same message", async () => {
    const wrong = await login("a@example.com", "wrong-password-1");
    expect(wrong.status).toBe(401);
    mocks.findUser.mockResolvedValue(null);
    const unknown = await login("nobody@example.com", "whatever-123");
    expect(unknown.status).toBe(401);
    expect((await unknown.json()).error.message).toBe((await wrong.json()).error.message);
  });

  it("429 with Retry-After after 10 tries on one account, even from different IPs", async () => {
    for (let i = 0; i < 10; i++) expect((await login("a@example.com", "wrong-password-1")).status).toBe(401);
    const res = await login("a@example.com", "correct-horse-1");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).error.message).toMatch(/รอประมาณ \d+ นาที/);
    // Another account is unaffected.
    expect((await login("b@example.com", "correct-horse-1")).status).toBe(200);
  });

  it("429 (not 500) when Auth.js refuses a verified password", async () => {
    mocks.signIn.mockResolvedValue("invalid");
    const res = await login("a@example.com", "correct-horse-1");
    expect(res.status).toBe(429);
  });

  it("429 with Retry-After when one IP floods", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 21; i++) last = await login(`user${i}@example.com`, "wrong-password-1", "9.9.9.9");
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
