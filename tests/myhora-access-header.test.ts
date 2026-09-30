import { describe, expect, it } from "vitest";
import { myhoraAccessHeader } from "@/server/horoscope/engine/myhora/fetch-myhora";

describe("myhora access header for the Cloudflare rule", () => {
  it("parses 'Name: value'", () => {
    expect(myhoraAccessHeader("X-Horasard-Access: s3cr3t")).toEqual({
      "X-Horasard-Access": "s3cr3t",
    });
  });

  it("keeps colons inside the value", () => {
    expect(myhoraAccessHeader("X-Key: a:b:c")).toEqual({ "X-Key": "a:b:c" });
  });

  it("adds nothing when unset or malformed", () => {
    expect(myhoraAccessHeader(undefined)).toEqual({});
    expect(myhoraAccessHeader("no-colon")).toEqual({});
    expect(myhoraAccessHeader("X-Key:")).toEqual({});
  });
});
