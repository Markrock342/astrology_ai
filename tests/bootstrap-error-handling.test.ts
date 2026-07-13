import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { mapBootstrapUserError } from "@/server/app/bootstrap-service";

describe("mapBootstrapUserError", () => {
  it("maps NOT_FOUND to UNAUTHENTICATED for stale sessions", () => {
    expect(() =>
      mapBootstrapUserError(new AppError("NOT_FOUND", "User not found")),
    ).toThrowError(
      expect.objectContaining({
        code: "UNAUTHENTICATED",
        message: expect.stringContaining("Session expired"),
      }),
    );
  });

  it("rethrows other AppErrors unchanged", () => {
    expect(() =>
      mapBootstrapUserError(new AppError("INTERNAL", "boom")),
    ).toThrowError(
      expect.objectContaining({
        code: "INTERNAL",
      }),
    );
  });

  it("rethrows non-AppError errors", () => {
    expect(() => mapBootstrapUserError(new TypeError("x"))).toThrow(TypeError);
  });
});
