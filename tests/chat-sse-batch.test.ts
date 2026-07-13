import { describe, expect, it } from "vitest";
import { foldChatSseDeltas, type ChatSseEvent } from "@/lib/chat-sse-batch";

describe("foldChatSseDeltas", () => {
  it("returns unchanged text when there are no delta events", () => {
    const events: ChatSseEvent[] = [
      { type: "status", text: "writing" },
      { type: "ping" },
    ];
    expect(foldChatSseDeltas("hello", events)).toEqual({
      assembled: "hello",
      hadDelta: false,
    });
  });

  it("concatenates multiple deltas in one network chunk", () => {
    const events: ChatSseEvent[] = [
      { type: "delta", text: "สวัสดี" },
      { type: "delta", text: "ครับ" },
      { type: "delta", text: "!" },
    ];
    expect(foldChatSseDeltas("", events)).toEqual({
      assembled: "สวัสดีครับ!",
      hadDelta: true,
    });
  });

  it("appends deltas onto existing assembled text", () => {
    const events: ChatSseEvent[] = [{ type: "delta", text: " world" }];
    expect(foldChatSseDeltas("hello", events)).toEqual({
      assembled: "hello world",
      hadDelta: true,
    });
  });

  it("ignores empty delta payloads", () => {
    const events: ChatSseEvent[] = [
      { type: "delta", text: "" },
      { type: "delta" },
    ];
    expect(foldChatSseDeltas("x", events)).toEqual({
      assembled: "x",
      hadDelta: false,
    });
  });
});
