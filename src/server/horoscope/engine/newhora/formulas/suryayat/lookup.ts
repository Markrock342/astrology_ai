/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BirthInput } from "../../types/astrology";
import type { PlaceCoords } from "../../data/placeCoordinates";

export type SuryayatLookupResult = {
  signs: Record<string, string | { sign: string }>;
  source: "reference" | "year";
} | null;

/**
 * Suryayat-100 calendar lookup (JSON year tables) is optional.
 * Returns null until year JSON files are copied from newhora — formula pipeline runs instead.
 */
export function lookupSuryayatSync(
  _input: BirthInput,
  _place: PlaceCoords,
): SuryayatLookupResult {
  return null;
}

export function lookupLagnaSync(_input: BirthInput, _place: PlaceCoords): string | null {
  return null;
}

export function lookupReferenceChart(_input: BirthInput, _place: PlaceCoords) {
  return null;
}
