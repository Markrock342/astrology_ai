import net from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Fetch-time SSRF guard for admin-supplied OpenAI-compatible Base URLs.
 *
 * The synchronous `assertSafeOpenAiBaseUrl` in `@/lib/ai-config-guards` can only
 * inspect the literal hostname string, so a public hostname that RESOLVES to an
 * internal address (DNS-to-internal), or an IP-literal in an exotic encoding
 * (IPv4-mapped IPv6, 127.0.0.0/8, decimal/hex), slips past it. This runs at the
 * moment we are about to call the provider: it resolves the host and rejects if
 * ANY resolved address lands in a loopback/private/link-local/reserved range —
 * which also covers literal IPs, since `dns.lookup` echoes them back.
 *
 * This is server-only (`node:dns`/`node:net`), so it lives out of the shared
 * client-safe guard module. It does not defeat a determined DNS-rebinding
 * attacker (TOCTOU between lookup and connect) — production should still enforce
 * egress at the network layer — but it closes every practical exploit an admin
 * could reach through the form.
 */
const BLOCKED = new net.BlockList();
// IPv4 loopback / private / CGNAT / link-local / unspecified / multicast / reserved
BLOCKED.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED.addSubnet("192.0.0.0", 24, "ipv4");
BLOCKED.addSubnet("224.0.0.0", 4, "ipv4");
BLOCKED.addSubnet("240.0.0.0", 4, "ipv4");
// IPv6 loopback / unspecified / ULA / link-local
BLOCKED.addAddress("::1", "ipv6");
BLOCKED.addAddress("::", "ipv6");
BLOCKED.addSubnet("fc00::", 7, "ipv6");
BLOCKED.addSubnet("fe80::", 10, "ipv6");

function isBlocked(address: string, family: number): boolean {
  const type = family === 6 ? "ipv6" : "ipv4";
  try {
    if (BLOCKED.check(address, type)) return true;
  } catch {
    // Unparseable address from the resolver — refuse rather than allow.
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded v4 against v4 rules.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(address);
  if (mapped && net.isIPv4(mapped[1])) {
    try {
      if (BLOCKED.check(mapped[1], "ipv4")) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Throw if the Base URL's host resolves to any non-public address.
 * Call immediately before fetching an OpenAI-compatible endpoint.
 */
export async function assertBaseUrlEgressAllowed(
  baseUrl: string,
): Promise<void> {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");
  } catch {
    throw new Error("Base URL ไม่ถูกต้อง");
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error("Base URL host resolve ไม่ได้");
  }
  if (addresses.length === 0) {
    throw new Error("Base URL host resolve ไม่ได้");
  }
  for (const { address, family } of addresses) {
    if (isBlocked(address, family)) {
      throw new Error("Base URL ชี้ไปเครือข่ายภายใน (ถูกปฏิเสธเพื่อความปลอดภัย)");
    }
  }
}
