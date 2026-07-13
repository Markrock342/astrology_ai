import { describe, expect, it } from "vitest";
import { parseChatRouteSearch } from "@/components/app/chat-nav";

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
