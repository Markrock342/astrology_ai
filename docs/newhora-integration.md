# newhora / myhora integration (scrape-first + formula fallback)

HoraSard builds chart evidence for AI readings from **myhora scrape first**
(same tables that work well in the newhora project), then lets Gemini **interpret
only those tables**. Local formula pipeline remains the fallback when scrape fails.

## Runtime flow

```
Save birth profile
  → queueNatalChart()
  → computeNatalChart()          // scrape-first
       ├─ ENABLE_MYHORA_SCRAPE (default on)
       │    → fetch myhora thai.aspx + embeds
       │    → map → ChartJson { calculationSource: "myhora-scrape", myhora: {...} }
       └─ on failure → formula-pipeline / suryayat-100
  → NatalChart { status: READY, chartJson }   // cached — no scrape per chat message

User sends chat
  → requireReadyNatalChart()     // load cache; recompute once if needed
  → [TRANSIT] computeTransitChart(transit snapshot, natal input)
  → formatChartForPrompt()       // samrap / taksa / triwai when present
  → Gemini (ENGINE_CHART_RULE: no inventing planets)
  → UI: HoroscopeChartPanel
       ├─ วงพื้นดวง / ดาวจร
       ├─ ราศีจักร D1
       ├─ นวางศ์จักร D9
       ├─ ตรียางศ์จักร D3
       └─ ทักษา / ตรีวัย (เมื่อ scrape grid สำเร็จ)
```

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `ENABLE_MYHORA_SCRAPE` | on | Set `false` / `0` / `off` to force local formulas only |
| `MYHORA_ORIGIN` | `https://myhora.com` | Upstream origin (server-side only) |
| `MYHORA_SCRAPE_TIMEOUT_MS` | `20000` | Per-request abort timeout |

Never scrape from the browser (CORS / leak). All fetch runs in Node on the server.

## chartJson shape

Type: `src/types/chart.ts` (`ChartJson`).

| Field | Description |
|-------|-------------|
| `input` | Birth date/time/place |
| `meta.calculationSource` | `myhora-scrape` \| `formula-pipeline` \| `suryayat-100-*` |
| `planets[]` | 10 planets → sidereal sign + optional degree |
| `chart.taksa[]` | Taksa from lagna (always filled) |
| `myhora` | Structured scrape tables: natalPlanets, transitPlanets, taksa grid, triwai, dateDetail |

The SVG charts never embed MyHora images or iframes. D1 uses structured
positions from the samrap table; D9/D3 are derived from those exact degrees
through the same client-safe functions used by the local engine. Formula charts
remain available when MyHora cannot be reached.

## Code map

| Path | Role |
|------|------|
| `engine/myhora/fetch-myhora.ts` | Node scrape (ViewState POST + embeds) |
| `engine/myhora/parse-*.ts` | HTML → structured tables |
| `engine/myhora/map-to-chart.ts` | Scrape → `ChartJson` |
| `engine/compute-chart.ts` | Scrape-first + formula fallback |
| `engine/format-chart-prompt.ts` | Evidence tables → AI prompt text |
| `natal-chart-service.ts` | Persist READY chart (cache) |
| `components/app/chart-evidence-table.tsx` | Show proof table in chat |
| `components/app/horoscope-chart-panel.tsx` | Responsive chart atlas attached to the first answer |
| `components/app/thai-chakra-chart.tsx` | HoraSard-owned SVG renderer for D1/D9/D3 |
| `lib/chart-derivations.ts` | MyHora rows → chart rows and shared D9/D3 formulas |

## Out of scope until scrape HTML exists

กาลจักร / พารณสี / ทศา (10luck) — add when parse paths return real data.

## Ops notes

- myhora HTML changes break parsers → formula fallback still serves chat
- Recompute is rate-limited (`natal-recompute:{userId}`, 5/min)
- Treat myhora as a brittle third party; prefer caching birth charts

## Own-engine correctness (Standard v1)

Local formula / suryayat path is locked by **HoraSard Standard v1** + 20 golden cases:

- Spec: [HORASARD_STANDARD_V1.md](./HORASARD_STANDARD_V1.md)
- Fixtures: `tests/fixtures/horasard-golden-v1.json`
- Test: `npm test -- tests/horasard-standard-v1.test.ts`

Scrape remains runtime evidence / parity only — golden tests never call myhora.
