import type { GenerateAIInput, GenerateAIResult } from "@/types";

/**
 * Provider-agnostic adapter contract (spec 3). Every provider (Gemini, OpenAI,
 * future ones) implements this. The router selects an adapter by config; UI
 * code never touches a provider directly.
 */
export interface AIProviderAdapter {
  generate(input: GenerateAIInput): Promise<GenerateAIResult>;
  validateModel(modelId: string): Promise<boolean>;
}
