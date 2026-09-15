import type { ChartJson } from "@/types/chart";
import { wheelChartFor, type WheelChartKind } from "@/lib/chart-derivations";
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
  kind = "natal",
}: {
  chart: ChartJson;
  className?: string;
  size?: number;
  /** When set, planet glyphs become tappable (used in the expanded lightbox). */
  onSelectPlanet?: (planet: string) => void;
  selectedPlanet?: string | null;
  /** Transit charts must draw their transit rows, not the natal table they carry. */
  kind?: WheelChartKind;
}) {
  const derived = wheelChartFor(chart, kind);
  return (
    <RasiTemplateChart
      chart={derived}
      size={size}
      className={className}
      onSelectPlanet={onSelectPlanet}
      selectedPlanet={selectedPlanet}
    />
  );
}
