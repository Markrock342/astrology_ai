import fs from "node:fs";
import path from "node:path";
import type { BirthInput } from "../../types/astrology";
import type { PlaceCoords } from "../../data/placeCoordinates";
import { PLANETS } from "../../data/astrologyConstants";
import type {
  SuryayatDayEntry,
  SuryayatPlanetSigns,
  SuryayatYearFile,
} from "../../data/suryayat100/types";
import { SURIYAYAT_REFERENCE_BY_KEY } from "../../data/suryayat100/referenceCharts";
import { buddhistYear, suryayatCalendarKey, suryayatDayKey } from "./calendarKey";

export type SuryayatLookupResult = {
  signs: SuryayatPlanetSigns;
  source: "reference" | "year";
} | null;

const yearByBe = new Map<number, SuryayatYearFile>();

function loadYearFiles() {
  if (yearByBe.size > 0) return;
  const dir = path.join(
    process.cwd(),
    "src/server/horoscope/engine/newhora/data/suryayat100/years",
  );
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json") || name.includes("example")) continue;
    const match = name.match(/^(\d{4})\.json$/);
    if (!match) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, name), "utf8");
      const file = JSON.parse(raw) as SuryayatYearFile;
      yearByBe.set(Number(match[1]), file);
    } catch {
      /* skip bad year file */
    }
  }
}

function normalizeSigns(raw: SuryayatPlanetSigns): SuryayatPlanetSigns | null {
  const out: SuryayatPlanetSigns = {};
  for (const planet of PLANETS) {
    const sign = raw[planet];
    if (!sign || sign === "—") return null;
    out[planet] = sign;
  }
  return out;
}

function entryToSigns(entry: SuryayatDayEntry): SuryayatPlanetSigns | null {
  return normalizeSigns(entry.planets);
}

export function lookupReferenceChart(
  input: BirthInput,
  place: PlaceCoords,
): SuryayatPlanetSigns | null {
  const key = suryayatCalendarKey(input, place);
  const raw = SURIYAYAT_REFERENCE_BY_KEY[key];
  return raw ? normalizeSigns(raw.planets) : null;
}

export function lookupReferenceLagna(
  input: BirthInput,
  place: PlaceCoords,
): string | null {
  const key = suryayatCalendarKey(input, place);
  return SURIYAYAT_REFERENCE_BY_KEY[key]?.lagna ?? null;
}

/**
 * Suryayat-100 lookup: reference charts + year JSON (Node fs).
 * Miss → null → formula-pipeline fallback in computeFullChartSync.
 */
export function lookupSuryayatSync(
  input: BirthInput,
  place: PlaceCoords,
): SuryayatLookupResult {
  loadYearFiles();

  const ref = lookupReferenceChart(input, place);
  if (ref) return { signs: ref, source: "reference" };

  const yearFile = yearByBe.get(buddhistYear(input.year));
  if (yearFile?.days) {
    const withTime = suryayatDayKey(input, true);
    const dayOnly = suryayatDayKey(input, false);
    const entry = yearFile.days[withTime] ?? yearFile.days[dayOnly];
    if (entry) {
      const signs = entryToSigns(entry);
      if (signs) return { signs, source: "year" };
    }
  }

  return null;
}

export function lookupLagnaSync(
  input: BirthInput,
  place: PlaceCoords,
): string | null {
  loadYearFiles();

  const ref = lookupReferenceLagna(input, place);
  if (ref) return ref;

  const yearFile = yearByBe.get(buddhistYear(input.year));
  if (!yearFile?.days) return null;
  const withTime = suryayatDayKey(input, true);
  const dayOnly = suryayatDayKey(input, false);
  const entry = yearFile.days[withTime] ?? yearFile.days[dayOnly];
  return entry?.lagna ?? null;
}
