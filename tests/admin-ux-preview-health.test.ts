import { describe, expect, it } from "vitest";
import { shouldRedirectLoggedInFromLanding } from "@/server/cms/landing-preview-policy";
import { adminFetchTimeoutMessage } from "@/lib/admin-fetch-timeout";

describe("shouldRedirectLoggedInFromLanding", () => {
  it("redirects logged-in users when not in preview", () => {
    expect(
      shouldRedirectLoggedInFromLanding({ isLoggedIn: true, isPreview: false }),
    ).toBe(true);
  });

  it("does not redirect when CMS preview cookie/mode is on", () => {
    expect(
      shouldRedirectLoggedInFromLanding({ isLoggedIn: true, isPreview: true }),
    ).toBe(false);
  });

  it("does not redirect anonymous visitors", () => {
    expect(
      shouldRedirectLoggedInFromLanding({ isLoggedIn: false, isPreview: false }),
    ).toBe(false);
    expect(
      shouldRedirectLoggedInFromLanding({ isLoggedIn: false, isPreview: true }),
    ).toBe(false);
  });
});

describe("adminFetchTimeoutMessage", () => {
  it("includes rounded seconds for the configured timeout", () => {
    expect(adminFetchTimeoutMessage(90_000)).toContain("90 วินาที");
    expect(adminFetchTimeoutMessage(45_000)).toContain("45 วินาที");
  });
});
