/** Single source of truth shared by engine, prompt and chart UI. */
export {
  computeTaksaFromBirth,
  isCurrentTaksaSlots,
  resolveTaksaBirthDay,
  TAKSA_NAMES,
  TAKSA_WEEKDAY_TABLE,
} from "@/lib/taksa";
export type { TaksaSlot } from "@/types/chart";
