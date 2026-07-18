/**
 * Pure helpers for landing hero full-bleed background (CMS-driven).
 * Kept free of React so unit tests stay fast.
 */

export const SAMPLE_LANDING_HERO_IMAGE = "/samples/landing-hero-bg.jpg";

/** Default overlay when applying the bundled theme sample. */
export const SAMPLE_LANDING_HERO_OVERLAY = 55;

export type HeroBackgroundType = "none" | "image" | "video";

export type HeroBackgroundInput = {
  backgroundType?: HeroBackgroundType | null;
  backgroundImageUrl?: string | null;
  backgroundVideoUrl?: string | null;
  backgroundOverlay?: number | null;
  imageUrl?: string | null;
};

export function mediaSrc(url?: string | null): string | null {
  const v = url?.trim();
  return v ? v : null;
}

/**
 * Direct playable file URLs for `<video src>`.
 * Rejects YouTube/Vimeo page URLs (those need an iframe, not a file src).
 */
export function isDirectVideoFileUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isPageEmbedVideoUrl(trimmed)) return false;
  // Strip query/hash for extension check
  const path = trimmed.split(/[?#]/)[0] ?? trimmed;
  return /\.(mp4|webm|ogg)$/i.test(path);
}

/** Watch-page / embed hosts that cannot be used as `<video src>`. */
export function isPageEmbedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url, "https://example.invalid");
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    return (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com" ||
      host === "vimeo.com" ||
      host === "player.vimeo.com"
    );
  } catch {
    return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
  }
}

export type ResolvedHeroBackground = {
  type: HeroBackgroundType;
  imageSrc: string | null;
  videoSrc: string | null;
  /** True when type+URL would render full-bleed media. */
  hasFullBleed: boolean;
  /** Missing URL while type is image/video. */
  missingMedia: boolean;
  /** Video type with a non-file / embed URL. */
  invalidVideoUrl: boolean;
  overlay: number;
  insetImage: string | null;
};

export function resolveHeroBackground(
  input: HeroBackgroundInput,
): ResolvedHeroBackground {
  const type = input.backgroundType ?? "none";
  const imageSrc = mediaSrc(input.backgroundImageUrl);
  const videoRaw = mediaSrc(input.backgroundVideoUrl);
  const overlay = Math.min(80, Math.max(0, input.backgroundOverlay ?? 55));

  const missingMedia =
    (type === "image" && !imageSrc) || (type === "video" && !videoRaw);

  const invalidVideoUrl = Boolean(
    type === "video" && videoRaw && !isDirectVideoFileUrl(videoRaw),
  );

  const hasBgImage = type === "image" && Boolean(imageSrc);
  const hasBgVideo =
    type === "video" && Boolean(videoRaw) && isDirectVideoFileUrl(videoRaw!);
  const hasFullBleed = hasBgImage || hasBgVideo;

  return {
    type,
    imageSrc: hasBgImage ? imageSrc : null,
    videoSrc: hasBgVideo ? videoRaw : null,
    hasFullBleed,
    missingMedia,
    invalidVideoUrl,
    overlay,
    insetImage: !hasFullBleed ? mediaSrc(input.imageUrl) : null,
  };
}

/** Patch hero fields with the bundled HoraSard sample still. */
export function sampleThemeHeroPatch(): {
  backgroundType: "image";
  backgroundImageUrl: string;
  backgroundOverlay: number;
} {
  return {
    backgroundType: "image",
    backgroundImageUrl: SAMPLE_LANDING_HERO_IMAGE,
    backgroundOverlay: SAMPLE_LANDING_HERO_OVERLAY,
  };
}
