/**
 * Everything a reading handed to the model, frozen with the reading so an
 * admin can prove afterwards which chart, which day, which doctrine and which
 * persona produced an answer — and check the answer against them.
 */
export type TracePlanet = { planet: string; sign: string };

export type TraceTemplate = { code: string; version: number } | null;

export type ReadingPromptTrace = {
  version: 1;
  createdAt: string;
  question: string;
  answerMode: "brief" | "detailed";
  plan: "FREE" | "PRO";
  /** natal = birth chart only; transit = birth chart + the day asked about. */
  intent: "natal" | "transit";
  window: {
    label: string;
    sampleAt: string;
    horizonAt: string | null;
    /** The user picked the date (modal / picker) rather than the system inferring it. */
    pickedByUser: boolean;
  };
  natal: {
    lagna: string;
    birthDisplay: string | null;
    source: string | null;
    planets: TracePlanet[];
  };
  transit: {
    lagna: string;
    asOf: string;
    source: string | null;
    planets: TracePlanet[];
  } | null;
  knowledge: {
    budgetChars: number;
    usedChars: number;
    chunks: Array<{
      title: string;
      chunkIndex: number;
      chunkCount: number;
      chars: number;
      score: number;
    }>;
  };
  templates: {
    system: TraceTemplate;
    persona: TraceTemplate;
    format: TraceTemplate;
  };
  model: { provider: string; modelId: string } | null;
  systemPrompt: string;
  userPrompt: string;
};
