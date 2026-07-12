import { describe, expect, it } from "vitest";
import { isPrismaPoolError } from "@/server/prisma-utils";

describe("isPrismaPoolError", () => {
  it("detects Prisma pool timeout messages", () => {
    expect(
      isPrismaPoolError(
        new Error(
          "Timed out fetching a new connection from the connection pool",
        ),
      ),
    ).toBe(true);
  });

  it("detects Prisma error codes", () => {
    expect(isPrismaPoolError({ code: "P2024", message: "x" })).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isPrismaPoolError(new Error("User not found"))).toBe(false);
  });
});
