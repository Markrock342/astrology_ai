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
    expect(verifyResendWebhook(body, headers, secret)).toBe(true);
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
