import { z } from "zod";
import { env } from "@/config/env";
import { AppError } from "@/lib/errors";
import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { matchThaiReverseAddress } from "@/lib/thai-address";
import { requireUser } from "@/server/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

type NominatimResult = {
  address?: Record<string, unknown>;
};

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const GEOCODER_BASE_URL =
  env.GEOCODER_BASE_URL ?? "https://nominatim.openstreetmap.org";

// Nominatim's public service caps the whole application at 1 req/s. Coolify
// runs one web process, so serialize cache misses here in addition to per-user
// limits. The base URL is configurable so ops can switch providers later.
let geocoderQueue: Promise<void> = Promise.resolve();
let lastGeocoderRequestAt = 0;

async function waitForGeocoderSlot() {
  const previous = geocoderQueue;
  let release!: () => void;
  geocoderQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const waitMs = Math.max(0, 1_050 - (Date.now() - lastGeocoderRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastGeocoderRequestAt = Date.now();
  release();
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`reverse-geo:${user.id}`, 5, 60_000);
    const input = bodySchema.parse(await req.json());

    // Roughly 110m precision identifies an amphoe/khet without forwarding the
    // user's exact GPS point to the provider.
    const latitude = Number(input.latitude.toFixed(3));
    const longitude = Number(input.longitude.toFixed(3));
    const url = new URL("/reverse", GEOCODER_BASE_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "th,en");
    url.searchParams.set("zoom", "14");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));

    await waitForGeocoderSlot();
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Referer: "https://horasard.com/",
        "User-Agent": "HoraSard/1.0 (+https://horasard.com/contact)",
      },
      next: { revalidate: CACHE_TTL_SECONDS },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new AppError(
        "INTERNAL",
        "ค้นหาจังหวัดและเขตจากตำแหน่งนี้ไม่ได้ ลองอีกครั้งหรือเลือกเอง",
      );
    }
    const result = (await response.json()) as NominatimResult;
    const matched = matchThaiReverseAddress(result.address ?? {});
    if (!matched) {
      throw new AppError(
        "VALIDATION",
        "ตอนนี้เติมจังหวัดและเขตอัตโนมัติได้เฉพาะตำแหน่งในประเทศไทย",
      );
    }

    return ok({
      country: "ไทย",
      ...matched,
      attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    });
  });
}
