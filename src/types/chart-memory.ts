import type { CalculationSource } from "@/types/chart";

/** One planet placement inside a focus house. */
export type MemoryPlanetInHouse = {
  planet: string;
  sign: string;
  house: number;
  dignity: string;
};

export type MemoryHouseLord = {
  house: number;
  sign: string;
  lord: string;
  lordSign: string | null;
  lordHouse: number | null;
};

/** Deterministic category focus derived from natal houses. */
export type CategoryFocus = {
  houses: number[];
  planetsInHouses: MemoryPlanetInHouse[];
  houseLords: MemoryHouseLord[];
  summaryLines: string[];
};

/**
 * Persisted user astrology memory — derived from engine chart only.
 * Never invent fields with an LLM.
 */
export type UserChartMemoryJson = {
  lagna: string;
  source?: CalculationSource | string;
  birthHash: string;
  computedAt: string;
  taksa: Array<{ taksa: string; sign: string }>;
  houseOccupants: Array<{ house: number; sign: string; planets: string[] }>;
  categories: {
    career: CategoryFocus;
    love: CategoryFocus;
    money: CategoryFocus;
    health: CategoryFocus;
  };
};
