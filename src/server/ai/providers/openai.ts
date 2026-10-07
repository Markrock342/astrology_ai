import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult, HoroscopeResponse } from "@/types";
import { assertBaseUrlEgressAllowed } from "@/server/ai/base-url-egress";

type OpenAIError = { message?: string; type?: string; code?: string; param?: string };

type OpenAIApiResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: OpenAIError;
};

type OpenAIStreamChunk = {
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: OpenAIApiResponse["usage"] | null;
  error?: OpenAIError;
};

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

function normalizeBaseUrl(baseUrl: string | undefined) {
  return (baseUrl?.trim() || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * OpenAI reasoning models (o-series, gpt-5 and later) reject `temperature != 1`
 * with HTTP 400 and spend part of the token budget on hidden reasoning. The
 * admin test of "gpt-6-luna" failed exactly so: the old pattern stopped at gpt-5.
 */
export function isReasoningModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  return /^(o[1-9]|gpt-([5-9]|\d{2}))(\b|[-.])/.test(id) || id.includes("reasoning");
}

/** Best-effort parse; horoscope output may be plain Thai prose if JSON parse fails. */
function parseHoroscopeText(raw: string): HoroscopeResponse | undefined {
  const jsonMatch = raw.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) return undefined;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as HoroscopeResponse;
    if (parsed.title && parsed.summary) return parsed;
  } catch {
    /* fall through */
  }
  return undefined;
}

/**
 * The request parameter a 400 says this model does not take, if any:
 * `param: "temperature"` or "Unsupported value: 'temperature' …". New model
 * families keep changing what they accept; one retry without it beats a
 * config that tests red until the code learns the model's name.
 */
export function rejectedParam(error: OpenAIError | undefined): string | null {
  if (!error) return null;
  const known = ["temperature", "max_completion_tokens", "max_tokens", "reasoning_effort", "stream_options"];
  if (error.param && known.includes(error.param)) return error.param;
  const quoted = error.message?.match(/'([a-z_]+)'/)?.[1];
  if (quoted && known.includes(quoted) && /unsupported|not support|unrecognized|unknown/i.test(error.message ?? "")) {
    return quoted;
  }
  return null;
}

type RequestBody = Record<string, unknown>;

/**
 * OpenAI chat-completions adapter (server-only). Enabled by creating an
 * AIProviderConfig with provider=OPENAI in the Admin CMS. Never throws;
 * returns ok:false on errors. Expects `input.apiKey` already resolved.
 */
export class OpenAIAdapter implements AIProviderAdapter {
  private body(input: GenerateAIInput, isOfficialOpenAI: boolean): RequestBody {
    const historyMessages = (input.conversationHistory ?? []).map((turn) => ({
      role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: turn.content,
    }));
    const reasoning = isReasoningModel(input.modelId);
    return {
      model: input.modelId,
      messages: [
        { role: "system", content: input.systemPrompt },
        ...historyMessages,
        { role: "user", content: input.userPrompt },
      ],
      // Reasoning models allow only the default temperature — sending any
      // other value is a hard 400, so omit it for them entirely.
      ...(reasoning ? {} : { temperature: input.temperature }),
      // A horoscope answer needs little hidden reasoning; low keeps it fast
      // and keeps the output budget for the answer itself.
      ...(reasoning && isOfficialOpenAI ? { reasoning_effort: "low" } : {}),
      // New OpenAI reasoning models use max_completion_tokens; most
      // compatible gateways still implement the established max_tokens.
      ...(isOfficialOpenAI
        ? { max_completion_tokens: input.maxOutputTokens }
        : { max_tokens: input.maxOutputTokens }),
    };
  }

  private fail(input: GenerateAIInput, start: number, errorCode: string, errorMessage: string): GenerateAIResult {
    return { ok: false, provider: "OPENAI", modelId: input.modelId, latencyMs: Date.now() - start, errorCode, errorMessage };
  }

  /**
   * POST with up to two retries, each dropping a parameter the model rejected.
   * Returns the response, or the parsed error body of the last failure.
   */
  private async post(
    url: string,
    apiKey: string,
    body: RequestBody,
    signal: AbortSignal,
  ): Promise<{ res: Response; error?: OpenAIError; json?: OpenAIApiResponse }> {
    let current = { ...body };
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal,
        redirect: "error",
        body: JSON.stringify(current),
      });
      if (res.ok) return { res };
      const json = (await res.json().catch(() => ({}))) as OpenAIApiResponse;
      const param = res.status === 400 ? rejectedParam(json.error) : null;
      if (param && param in current && attempt < 2) {
        current = Object.fromEntries(Object.entries(current).filter(([key]) => key !== param));
        continue;
      }
      return { res, error: json.error, json };
    }
  }

  private async prepare(input: GenerateAIInput, start: number) {
    if (!input.apiKey) {
      return {
        failure: this.fail(
          input,
          start,
          "MISSING_API_KEY",
          `API key not configured${input.secretReference ? ` (${input.secretReference})` : ""}`,
        ),
      };
    }
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const isOfficialOpenAI = baseUrl === OPENAI_DEFAULT_BASE_URL;
    // SSRF guard: resolve the host and reject internal targets before we send
    // the API key anywhere. Skipped for the fixed official OpenAI endpoint.
    if (!isOfficialOpenAI) await assertBaseUrlEgressAllowed(baseUrl);
    return { apiKey: input.apiKey, baseUrl, isOfficialOpenAI };
  }

  async generate(input: GenerateAIInput): Promise<GenerateAIResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const prep = await this.prepare(input, start);
      if ("failure" in prep) return prep.failure!;
      const { res, error } = await this.post(
        `${prep.baseUrl}/chat/completions`,
        prep.apiKey,
        this.body(input, prep.isOfficialOpenAI),
        controller.signal,
      );
      if (!res.ok) {
        return this.fail(input, start, error?.code ?? error?.type ?? String(res.status), error?.message ?? `OpenAI HTTP ${res.status}`);
      }
      const data = (await res.json()) as OpenAIApiResponse;
      const rawText = data.choices?.[0]?.message?.content?.trim();
      if (!rawText) return this.fail(input, start, "EMPTY_RESPONSE", "OpenAI returned no text");
      const truncated = data.choices?.[0]?.finish_reason === "length";
      return {
        ok: true,
        provider: "OPENAI",
        modelId: input.modelId,
        rawText,
        parsed: parseHoroscopeText(rawText),
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          // completion_tokens includes reasoning tokens — billed as output.
          outputTokens: data.usage?.completion_tokens,
          cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens,
        },
        latencyMs: Date.now() - start,
        ...(truncated ? { truncated: true, truncatedBy: "budget" as const } : {}),
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return this.fail(
        input,
        start,
        isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
        err instanceof Error ? err.message : "OpenAI request failed",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Token-by-token answer, as Gemini gives. GPT answers used to arrive in one
   * block after the whole wait. Same contract as GeminiAdapter.streamGenerate:
   * a stop keeps what streamed (ok, stopped); a stream that closes with no
   * finish reason is a truncated connection.
   */
  async streamGenerate(
    input: GenerateAIInput,
    onDelta: (chunk: string) => void,
    shouldStop?: () => Promise<boolean>,
  ): Promise<GenerateAIResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    let text = "";
    let firstTokenMs: number | undefined;
    let finish: string | null = null;
    let usage: OpenAIApiResponse["usage"] | null = null;
    let stopped = false;

    try {
      const prep = await this.prepare(input, start);
      if ("failure" in prep) return prep.failure!;
      const { res, error } = await this.post(
        `${prep.baseUrl}/chat/completions`,
        prep.apiKey,
        { ...this.body(input, prep.isOfficialOpenAI), stream: true, stream_options: { include_usage: true } },
        controller.signal,
      );
      if (!res.ok || !res.body) {
        return this.fail(input, start, error?.code ?? error?.type ?? String(res.status), error?.message ?? `OpenAI HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastStopCheck = Date.now();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const payload = line.trim().replace(/^data:\s*/, "");
          if (!payload || payload === "[DONE]" || !line.trim().startsWith("data:")) continue;
          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(payload) as OpenAIStreamChunk;
          } catch {
            continue;
          }
          if (chunk.error) {
            return this.fail(input, start, chunk.error.code ?? "PROVIDER_ERROR", chunk.error.message ?? "OpenAI stream error");
          }
          const choice = chunk.choices?.[0];
          const delta = choice?.delta?.content;
          if (delta) {
            if (firstTokenMs === undefined) firstTokenMs = Date.now() - start;
            text += delta;
            onDelta(delta);
          }
          if (choice?.finish_reason) finish = choice.finish_reason;
          if (chunk.usage) usage = chunk.usage;
        }
        if (shouldStop && Date.now() - lastStopCheck > 800) {
          lastStopCheck = Date.now();
          if (await shouldStop()) {
            stopped = true;
            controller.abort();
            break;
          }
        }
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!stopped && !text) {
        return this.fail(input, start, isAbort ? "TIMEOUT" : "PROVIDER_ERROR", err instanceof Error ? err.message : "OpenAI stream failed");
      }
      // Text already reached the reader: keep it, marked as cut.
    } finally {
      clearTimeout(timer);
    }

    const rawText = text.trim();
    if (!rawText && !stopped) return this.fail(input, start, "EMPTY_RESPONSE", "OpenAI returned no text");
    const truncatedBy = stopped ? undefined : finish === "length" ? ("budget" as const) : finish ? undefined : ("connection" as const);
    return {
      ok: true,
      provider: "OPENAI",
      modelId: input.modelId,
      rawText,
      parsed: parseHoroscopeText(rawText),
      usage: {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        cachedTokens: usage?.prompt_tokens_details?.cached_tokens,
      },
      latencyMs: Date.now() - start,
      firstTokenMs,
      ...(stopped ? { stopped: true } : {}),
      ...(truncatedBy ? { truncated: true, truncatedBy } : {}),
    };
  }

  async validateModel(modelId: string): Promise<boolean> {
    return typeof modelId === "string" && modelId.length > 0;
  }
}
