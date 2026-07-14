import { describe, expect, it } from "vitest";
import {
  parseChatRouteSearch,
  shouldUseSoftChatNav,
} from "@/components/app/chat-nav";

describe("parseChatRouteSearch", () => {
  it("reads cat and thread from query string", () => {
    expect(parseChatRouteSearch("cat=identity&thread=abc123")).toEqual({
      cat: "identity",
      thread: "abc123",
    });
  });

  it("returns nulls when params are absent", () => {
    expect(parseChatRouteSearch("")).toEqual({ cat: null, thread: null });
  });

  it("ignores unrelated params", () => {
    expect(parseChatRouteSearch("foo=bar&cat=career")).toEqual({
      cat: "career",
      thread: null,
    });
  });
});

describe("shouldUseSoftChatNav", () => {
  it("allows soft nav between dashboard query switches", () => {
    expect(shouldUseSoftChatNav("/dashboard", "/dashboard?cat=identity")).toBe(
      true,
    );
    expect(
      shouldUseSoftChatNav("/dashboard", "/dashboard?thread=abc&cat=career"),
    ).toBe(true);
    expect(shouldUseSoftChatNav("/dashboard", "/dashboard")).toBe(true);
  });

  it("requires real navigation from account or onboarding to dashboard", () => {
    expect(shouldUseSoftChatNav("/account", "/dashboard?cat=identity")).toBe(
      false,
    );
    expect(shouldUseSoftChatNav("/onboarding", "/dashboard")).toBe(false);
    expect(shouldUseSoftChatNav("/account", "/dashboard?thread=t1")).toBe(
      false,
    );
  });

  it("requires real navigation leaving dashboard to other routes", () => {
    expect(shouldUseSoftChatNav("/dashboard", "/account")).toBe(false);
    expect(shouldUseSoftChatNav("/dashboard", "/onboarding")).toBe(false);
  });
});
