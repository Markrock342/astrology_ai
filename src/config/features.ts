/**
 * Milestone / phase feature gating.
 *
 * The deployed demo (Vercel) can be limited to a milestone so the client only
 * sees what has been paid for, while local dev stays ahead with everything on.
 *
 * Control with the public env var `NEXT_PUBLIC_APP_PHASE` (inlined at build,
 * readable on both server and client). Leave it UNSET locally to show all
 * features; set `NEXT_PUBLIC_APP_PHASE=2` on Vercel to show only Milestone 2.
 *
 *   Phase 2 = auth, birth profile, Free/Pro, categories, basic admin
 *   Phase 3 = live AI chat, credit/quota, Admin AI CMS (models/prompts/knowledge)
 */
const parsedPhase = Number.parseInt(process.env.NEXT_PUBLIC_APP_PHASE ?? "", 10);

/** Current phase; defaults to "everything on" when the flag is unset/invalid. */
export const APP_PHASE = Number.isNaN(parsedPhase) ? 99 : parsedPhase;

export function phaseAtLeast(min: number): boolean {
  return APP_PHASE >= min;
}

export const FEATURES = {
  /** Live AI chat + credit deduction (readings API). */
  aiChat: phaseAtLeast(3),
  /** Admin AI CMS: model configs, prompts/persona, knowledge base, AI logs. */
  aiAdmin: phaseAtLeast(3),
} as const;
