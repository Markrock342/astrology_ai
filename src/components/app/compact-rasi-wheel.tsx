import type { ChartJson } from "@/types/chart";
import { RasiTemplateChart } from "./rasi-template-chart";

/**
 * Compact rasi wheel — outer ring `{เลขไทยเรือน} {ราศี}`, inner planets as
 * Thai numerals (๑ อาทิตย์ … ๐ มฤตยู), lagna marked ล in the gold cell.
 */
export function CompactRasiWheel({
  chart,
  className = "",
  size = 140,
  onSelectPlanet,
  selectedPlanet,
}: {
  chart: ChartJson;
  className?: string;
  size?: number;
  /** When set, planet glyphs become tappable (used in the expanded lightbox). */
  onSelectPlanet?: (planet: string) => void;
  selectedPlanet?: string | null;
}) {
  return (
    <RasiTemplateChart
      chart={{
        lagna: chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ",
        planets: chart.planets,
      }}
      size={size}
      className={className}
      onSelectPlanet={onSelectPlanet}
      selectedPlanet={selectedPlanet}
    />
  );
}
