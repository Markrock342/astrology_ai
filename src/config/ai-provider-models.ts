import type { AIProvider } from "@prisma/client";
import {
  DEFAULT_GEMINI_MODEL_ID,
  GEMINI_MODEL_PRESETS,
} from "@/config/gemini-models";

export type SupportedAIProvider = Extract<AIProvider, "GEMINI" | "OPENAI">;

export const DEFAULT_OPENAI_MODEL_ID = "gpt-5.6";

export const OPENAI_MODEL_PRESETS: { id: string; label: string }[] = [
  { id: DEFAULT_OPENAI_MODEL_ID, label: "GPT 5.6 — ค่าเริ่มต้น" },
  { id: "gpt-5.6-mini", label: "GPT 5.6 Mini — เร็ว/ประหยัด" },
  { id: "gpt-5.6-pro", label: "GPT 5.6 Pro — ละเอียด" },
];

export function providerLabel(provider: SupportedAIProvider): string {
  return provider === "GEMINI" ? "Gemini" : "OpenAI-compatible";
}

export function defaultModelForProvider(provider: SupportedAIProvider): string {
  return provider === "GEMINI" ? DEFAULT_GEMINI_MODEL_ID : DEFAULT_OPENAI_MODEL_ID;
}

export function modelPresetsForProvider(provider: SupportedAIProvider) {
  return provider === "GEMINI" ? GEMINI_MODEL_PRESETS : OPENAI_MODEL_PRESETS;
}

export function modelPlaceholderForProvider(provider: SupportedAIProvider): string {
  return provider === "GEMINI" ? "gemini-3.5-flash" : "gpt-5.6 หรือ composer-2.5";
}

export function displayNamePlaceholderForProvider(provider: SupportedAIProvider): string {
  return provider === "GEMINI"
    ? "เช่น Free — Flash Lite"
    : "เช่น GPT 5.6 (OpenAI) หรือ Composer 2.5 (Cursor)";
}

/** Suggested admin display name when picking a preset (empty until user edits). */
export function suggestedDisplayNameForModel(
  provider: SupportedAIProvider,
  modelId: string,
): string {
  const preset = modelPresetsForProvider(provider).find((p) => p.id === modelId);
  if (!preset) return "";
  return provider === "GEMINI" ? `Gemini — ${preset.label}` : `OpenAI — ${preset.label}`;
}

export function baseUrlPlaceholderForProvider(provider: SupportedAIProvider): string {
  return provider === "OPENAI" ? "https://api.openai.com/v1" : "";
}
