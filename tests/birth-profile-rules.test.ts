import { describe, expect, it } from "vitest";
import {
  MAX_BIRTH_EDITS,
  canEditBirthProfile,
  getEditsRemaining,
} from "@/server/user/birth-profile-service";

describe("birth profile edit rules (M2)", () => {
  it("allows edit when editCount is 0", () => {
    expect(canEditBirthProfile(0)).toBe(true);
    expect(getEditsRemaining(0)).toBe(1);
  });

  it("blocks further edits once editCount reaches MAX_BIRTH_EDITS", () => {
    expect(canEditBirthProfile(MAX_BIRTH_EDITS)).toBe(false);
    expect(getEditsRemaining(MAX_BIRTH_EDITS)).toBe(0);
  });

  it("returns full allowance when profile does not exist yet", () => {
    expect(getEditsRemaining(null)).toBe(MAX_BIRTH_EDITS);
    expect(getEditsRemaining(undefined)).toBe(MAX_BIRTH_EDITS);
  });
});
