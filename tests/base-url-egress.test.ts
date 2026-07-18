import { afterEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

import { assertBaseUrlEgressAllowed } from "@/server/ai/base-url-egress";

function resolvesTo(...addrs: Array<{ address: string; family: number }>) {
  lookupMock.mockResolvedValue(addrs);
}

describe("assertBaseUrlEgressAllowed (SSRF)", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows a host that resolves to a public IP", async () => {
    resolvesTo({ address: "104.18.32.10", family: 4 });
    await expect(
      assertBaseUrlEgressAllowed("https://gateway.example.com/v1"),
    ).resolves.toBeUndefined();
  });

  it("rejects a public hostname that resolves to a private IP (DNS-to-internal)", async () => {
    resolvesTo({ address: "10.0.0.5", family: 4 });
    await expect(
      assertBaseUrlEgressAllowed("https://sneaky.attacker.com/v1"),
    ).rejects.toThrow(/ภายใน/);
  });

  it("rejects the cloud metadata address", async () => {
    resolvesTo({ address: "169.254.169.254", family: 4 });
    await expect(
      assertBaseUrlEgressAllowed("https://metadata.example/v1"),
    ).rejects.toThrow(/ภายใน/);
  });

  it("rejects loopback in any octet of 127.0.0.0/8", async () => {
    resolvesTo({ address: "127.0.0.2", family: 4 });
    await expect(
      assertBaseUrlEgressAllowed("https://lo.example/v1"),
    ).rejects.toThrow(/ภายใน/);
  });

  it("rejects an IPv4-mapped IPv6 metadata address", async () => {
    resolvesTo({ address: "::ffff:169.254.169.254", family: 6 });
    await expect(
      assertBaseUrlEgressAllowed("https://mapped.example/v1"),
    ).rejects.toThrow(/ภายใน/);
  });

  it("rejects IPv6 loopback and link-local", async () => {
    resolvesTo({ address: "::1", family: 6 });
    await expect(
      assertBaseUrlEgressAllowed("https://v6lo.example/v1"),
    ).rejects.toThrow(/ภายใน/);
    resolvesTo({ address: "fe80::1", family: 6 });
    await expect(
      assertBaseUrlEgressAllowed("https://ll.example/v1"),
    ).rejects.toThrow(/ภายใน/);
  });

  it("rejects when ANY resolved address is private (multi-record)", async () => {
    resolvesTo(
      { address: "104.18.32.10", family: 4 },
      { address: "192.168.1.1", family: 4 },
    );
    await expect(
      assertBaseUrlEgressAllowed("https://mixed.example/v1"),
    ).rejects.toThrow(/ภายใน/);
  });

  it("rejects a host that fails to resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(
      assertBaseUrlEgressAllowed("https://nope.example/v1"),
    ).rejects.toThrow(/resolve/);
  });
});
