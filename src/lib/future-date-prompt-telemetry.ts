import { z } from "zod";
import { FUTURE_DATE_PROMPT_TRIGGERS } from "@/lib/reading-intent";

export const FUTURE_DATE_PROMPT_ACTIONS = ["CONFIRMED", "CANCELLED"] as const;
export type FutureDatePromptAction =
  (typeof FUTURE_DATE_PROMPT_ACTIONS)[number];

/** Strict by design: unexpected fields such as `question` are rejected. */
export const futureDatePromptEventBodySchema = z
  .object({
    trigger: z.enum(FUTURE_DATE_PROMPT_TRIGGERS),
    action: z.enum(FUTURE_DATE_PROMPT_ACTIONS),
  })
  .strict();
