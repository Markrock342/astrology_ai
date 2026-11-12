export const PUBLIC_NOMINATIM_URL = "https://nominatim.openstreetmap.org";

export type GeocoderUrls = {
  primary: string;
  fallback: string;
};

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Our own Thailand instance runs on HoraSard's server and is configured only
 * through GEOCODER_BASE_URL. Without it the app uses the policy-limited public
 * service directly; there is deliberately no built-in self-hosted default.
 */
export function resolveGeocoderUrls(config: {
  GEOCODER_BASE_URL?: string;
  GEOCODER_FALLBACK_BASE_URL?: string;
}): GeocoderUrls {
  return {
    primary: trimTrailingSlashes(config.GEOCODER_BASE_URL ?? PUBLIC_NOMINATIM_URL),
    fallback: trimTrailingSlashes(
      config.GEOCODER_FALLBACK_BASE_URL ?? PUBLIC_NOMINATIM_URL,
    ),
  };
}
