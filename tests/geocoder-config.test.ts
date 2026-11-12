import { describe, expect, it } from "vitest";
import { PUBLIC_NOMINATIM_URL, resolveGeocoderUrls } from "@/lib/geocoder-config";

describe("reverse geocoder configuration", () => {
  it("uses only the public service when no own instance is configured", () => {
    // No hidden self-hosted default: an unset variable must never route
    // traffic to a server that is not HoraSard's.
    expect(resolveGeocoderUrls({})).toEqual({
      primary: PUBLIC_NOMINATIM_URL,
      fallback: PUBLIC_NOMINATIM_URL,
    });
  });

  it("uses the configured own instance first and keeps the public fallback", () => {
    expect(
      resolveGeocoderUrls({ GEOCODER_BASE_URL: "http://horasard-nominatim:8080/" }),
    ).toEqual({
      primary: "http://horasard-nominatim:8080",
      fallback: PUBLIC_NOMINATIM_URL,
    });
  });

  it("honours an explicit fallback and strips trailing slashes", () => {
    expect(
      resolveGeocoderUrls({
        GEOCODER_BASE_URL: "http://geo.internal:8080//",
        GEOCODER_FALLBACK_BASE_URL: "https://fallback.example/",
      }),
    ).toEqual({
      primary: "http://geo.internal:8080",
      fallback: "https://fallback.example",
    });
  });
});
