# newhora engine integration

HoraSard computes natal charts using a **vendored copy** of the [newhora](https://github.com/) formula pipeline (Thai suryayat / Lahiri / Antonathi samrap).

## chartJson shape

Stored in `NatalChart.chartJson` — TypeScript type: `src/types/chart.ts` (`ChartJson`).

| Field | Description |
|-------|-------------|
| `input` | Birth date/time/place sent to the engine |
| `calculatedAt` | ISO timestamp |
| `settings` | Fixed Thai calculation rules (suryayat, lahiri, …) |
| `meta.lagna` | Ascendant sign (ลัคนา) |
| `meta.calculationSource` | `formula-pipeline` \| `suryayat-100-*` (when year tables added) |
| `planets[]` | 10 planets → sidereal sign |
| `chart.taksa[]` | Taksa slots from lagna |

## Code map

| Path | Role |
|------|------|
| `src/server/horoscope/engine/compute-chart.ts` | Entry: `computeNatalChart(input)` |
| `src/server/horoscope/engine/birth-input-mapper.ts` | `BirthProfile` → engine input |
| `src/server/horoscope/engine/format-chart-prompt.ts` | Chart → Thai text for AI |
| `src/server/horoscope/engine/newhora/` | Vendored formulas from newhora repo |
| `src/server/horoscope/natal-chart-service.ts` | Compute on birth save → DB |
| `src/server/horoscope/chart-context.ts` | Load READY chart for chat |
| `src/server/horoscope/prompt-resolver.ts` | System/persona/format from CMS |
| `src/server/ai/prompt-builder.ts` | Assemble system + user prompts |

## Runtime flow

```
Save birth profile
  → queueNatalChart()
  → computeNatalChart()  (astronomy-engine + formulas)
  → NatalChart { status: READY, chartJson }

User sends chat message
  → loadChartForUser()
  → buildUserPrompt(profile, question, chartJson)
  → Gemini
```

## Suryayat-100 calendar (optional upgrade)

newhora can lookup precomputed year JSON (`data/suryayat100/years/*.json`).  
Our vendored `lookup.ts` currently returns `null` → always uses **formula-pipeline**.

To enable calendar lookup:

1. Copy `newhora/src/data/suryayat100/` into `engine/newhora/data/suryayat100/`
2. Replace `lookup.ts` with newhora version adapted for Node (no `import.meta.glob` — use `fs.readdir` or static imports)

## Syncing from newhora

Source of truth: `code-archive/newhora` (or your git remote).

```bash
# Example: refresh formula files after newhora updates
cp newhora/src/utils/formulas/*.ts hora_ai/src/server/horoscope/engine/newhora/formulas/
# Re-apply lookup stub or port glob loader
npm run typecheck
```

## Dependencies

- `astronomy-engine` — ephemeris for formula fallback path

No `NEWHORA_ROOT` env required — engine is embedded in this repo.
