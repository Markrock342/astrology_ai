import { generateWithFallback } from "@/server/ai/router";
import { logUsage } from "@/server/ai/usage-logger";
import { resolveAuxConfig } from "@/server/horoscope/follow-up-suggestions";

/**
 * An answer that named the wrong house lord or ทักษาจร used to keep the wrong
 * reasoning and gain an "*แก้ไข: …*" footnote — graders called it the worst
 * thing they saw. The lines holding the wrong claims are rewritten with the
 * true facts instead; the caller re-checks and only footnotes what is left.
 */
export async function rewriteWrongClaims(
  text: string,
  issues: Array<{ excerpt: string; truth: string }>,
  userId: string,
): Promise<string> {
  if (!issues.length) return text;
  const lines = text.split("\n");
  const targets = [...new Set(issues.flatMap((i) => lines.flatMap((l, n) => (l.includes(i.excerpt) ? [n] : []))))];
  if (!targets.length) return text;
  try {
    const cfg = await resolveAuxConfig();
    if (!cfg) return text;
    const result = await generateWithFallback(cfg.id, {
      systemPrompt: `แก้บรรทัดคำทำนายภาษาไทยให้ตรงกับข้อเท็จจริงของดวงที่ให้มา
แก้เฉพาะคำหรือวลีที่ผิด และปรับผลที่อ้างจากข้อนั้นให้สอดคล้อง ห้ามเพิ่มเรื่องใหม่ คง markdown เดิม
ตอบเป็น JSON เท่านั้น รูปแบบ {"<เลขบรรทัด>":"<บรรทัดที่แก้แล้ว>"}`,
      userPrompt: `ข้อเท็จจริงที่ถูกต้อง:\n${issues.map((i) => `- ${i.truth}`).join("\n")}\n\nบรรทัดที่ต้องแก้:\n${targets
        .map((n) => `${n}: ${lines[n]}`)
        .join("\n")}`,
      maxOutputTokens: 1_500,
      timeoutMs: 10_000,
    });
    if (!result.ok || !result.rawText) return text;
    void logUsage({
      userId,
      provider: result.provider,
      modelId: result.modelId,
      status: "SUCCESS",
      latencyMs: result.latencyMs,
      inputUsage: result.usage?.inputTokens,
      outputUsage: result.usage?.outputTokens,
      cachedUsage: result.usage?.cachedTokens,
      errorCode: "FACT_REPAIR",
    }).catch(() => {});
    const m = result.rawText.match(/\{[\s\S]*\}/);
    const fixed = m ? (JSON.parse(m[0]) as Record<string, unknown>) : {};
    for (const n of targets) {
      const line = fixed[String(n)];
      if (typeof line === "string" && line.trim()) lines[n] = line;
    }
    return lines.join("\n");
  } catch (err) {
    console.warn("[fact-repair]", err instanceof Error ? err.message : err);
    return text;
  }
}
