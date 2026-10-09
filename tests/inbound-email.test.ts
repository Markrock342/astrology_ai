import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyResendWebhook } from "@/server/email/inbound";

describe("verifyResendWebhook", () => {
  it("accepts a valid Svix v1 signature", () => {
    const secret = `whsec_${Buffer.from("test-secret-bytes!!").toString("base64")}`;
    const body = `{"type":"email.received"}`;
    const id = "msg_1";
    const timestamp = "1710000000";
    const key = Buffer.from("test-secret-bytes!!");
    const sig = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${sig}`,
    });
    expect(verifyResendWebhook(body, headers, secret, 1710000000_000 + 60_000)).toBe(true);
  });

  // Code review 2026-10-09: a signed request could be replayed forever.
  it("rejects a valid signature older than five minutes", () => {
    const secret = `whsec_${Buffer.from("test-secret-bytes!!").toString("base64")}`;
    const body = `{"type":"email.received"}`;
    const sig = createHmac("sha256", Buffer.from("test-secret-bytes!!"))
      .update(`msg_1.1710000000.${body}`)
      .digest("base64");
    const headers = new Headers({ "svix-id": "msg_1", "svix-timestamp": "1710000000", "svix-signature": `v1,${sig}` });
    expect(verifyResendWebhook(body, headers, secret, 1710000000_000 + 6 * 60_000)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const secret = `whsec_${Buffer.from("test-secret-bytes!!").toString("base64")}`;
    const headers = new Headers({
      "svix-id": "msg_1",
      "svix-timestamp": "1710000000",
      "svix-signature": "v1,aaaa",
    });
    expect(verifyResendWebhook("{}", headers, secret)).toBe(false);
  });
});
