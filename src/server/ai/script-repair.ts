import { generateWithFallback } from "@/server/ai/router";
import { logUsage } from "@/server/ai/usage-logger";
import { resolveAuxConfig } from "@/server/horoscope/follow-up-suggestions";

/**
 * Gemini now and then emits another script inside a Thai word — a user saw
 * "อุปظـسakเฉพาะหน้า" for "อุปสรรคเฉพาะหน้า". The lines it happens in are
 * sent to a small model to be put back in Thai; nothing else is touched.
 * If that fails, the stray letters are at least removed.
 */
const FOREIGN_SCRIPT =
  /[֐-׿؀-ۿݐ-ݿࢠ-ࣿЀ-ӿऀ-ॿঀ-৿຀-໿က-႟ក-៿぀-ヿ㐀-鿿가-힯ﭐ-﷿ﹰ-﻿]/;
const FOREIGN_SCRIPT_G = new RegExp(FOREIGN_SCRIPT.source, "g");
/** Latin letters wedged inside a Thai word, no space either side ("ปakเ"). */
const LATIN_IN_THAI = /[ก-๎][A-Za-z]{1,3}[ก-๎]/;

export function findGlitchedLines(text: string): number[] {
  return text
    .split("\n")
    .flatMap((line, i) => (FOREIGN_SCRIPT.test(line) || LATIN_IN_THAI.test(line) ? [i] : []));
}

/** Last resort: drop the stray letters rather than show them. */
export function stripGlitches(line: string): string {
  return line
    .replace(FOREIGN_SCRIPT_G, "")
    .replace(/([ก-๎])[A-Za-z]{1,3}(?=[ก-๎])/g, "$1")
    .replace(/ـ/g, "");
}

function parseJson(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function repairScriptGlitches(text: string, userId: string): Promise<string> {
  const idx = findGlitchedLines(text);
  if (!idx.length) return text;
  const lines = text.split("\n");
  try {
    const cfg = await resolveAuxConfig();
    if (cfg) {
      const result = await generateWithFallback(cfg.id, {
        systemPrompt: `ข้อความภาษาไทยต่อไปนี้มีอักขระภาษาอื่นหรือตัวอักษรเพี้ยนปนเข้ามากลางคำ (ระบบพิมพ์ผิด)
แก้เฉพาะคำที่เสียให้เป็นคำไทยที่ถูกต้องตามบริบท ห้ามเปลี่ยน เพิ่ม หรือตัดส่วนอื่น คงเครื่องหมายและ markdown เดิม
ตอบเป็น JSON เท่านั้น รูปแบบ {"<เลขบรรทัด>":"<บรรทัดที่แก้แล้ว>"}`,
        userPrompt: idx.map((i) => `${i}: ${lines[i]}`).join("\n"),
        maxOutputTokens: 1_024,
        timeoutMs: 8_000,
      });
      if (result.ok && result.rawText) {
        void logUsage({
          userId,
          provider: result.provider,
          modelId: result.modelId,
          status: "SUCCESS",
          latencyMs: result.latencyMs,
          inputUsage: result.usage?.inputTokens,
          outputUsage: result.usage?.outputTokens,
          cachedUsage: result.usage?.cachedTokens,
          errorCode: "SCRIPT_REPAIR",
        }).catch(() => {});
        const fixed = parseJson(result.rawText) ?? {};
        for (const i of idx) {
          const candidate = fixed[String(i)];
          if (typeof candidate === "string" && candidate.trim() && findGlitchedLines(candidate).length === 0) {
            lines[i] = candidate;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[script-repair]", err instanceof Error ? err.message : err);
  }
  // Whatever the model did not fix, strip.
  for (const i of idx) if (findGlitchedLines(lines[i]!).length) lines[i] = stripGlitches(lines[i]!);
  return lines.join("\n");
}
