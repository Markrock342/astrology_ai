import type { AIProvider } from "@prisma/client";

/**
 * Validated, structured horoscope output. The AI adapter must return content
 * that maps into this shape; we validate before saving/displaying (spec 7.3).
 */
export type HoroscopeResponse = {
  title: string;
  summary: string;
  interpretation: string[];
  strengths?: string[];
  cautions?: string[];
  guidance?: string[];
  closing?: string;
};

export type BirthProfileSnapshot = {
  nickname?: string | null;
  birthDate: string; // ISO (UTC)
  birthTime?: string | null;
  birthTimeKnown: boolean;
  gender?: string | null;
  birthLocation?: string | null;
  additionalInfo?: string | null;
};

/** Input passed into a provider adapter. Fully assembled prompt, no secrets. */
export type GenerateAIInput = {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Env var name that holds the API key (resolved by the adapter, never logged). */
  secretReference: string;
};

/** Normalized result returned by every provider adapter. */
export type GenerateAIResult = {
  ok: boolean;
  provider: AIProvider;
  modelId: string;
  /** Raw text; the router parses/validates it into HoroscopeResponse. */
  rawText?: string;
  parsed?: HoroscopeResponse;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
};
