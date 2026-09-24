import { KNOWLEDGE_MAX_CHARS } from "@/config/constants";

export type KnowledgeSourceDoc = {
  id?: string;
  title: string;
  content: string;
  categoryId?: string | null;
  sortOrder?: number;
};

export type KnowledgeRetrievalInput = {
  /** The user's current question carries the strongest retrieval weight. */
  query: string;
  /** Chart/category facts that disambiguate a short question such as "แล้วปีหน้าล่ะ". */
  context?: string;
  categoryId?: string;
  maxChars?: number;
};

export type RetrievedKnowledgeChunk = {
  documentId: string;
  title: string;
  content: string;
  chunkIndex: number;
  chunkCount: number;
  score: number;
  sortOrder: number;
  /** Sent because it defines a rule the method always needs, not for matching the question. */
  pinned?: boolean;
};

/**
 * Words that mark a passage as a DEFINITION the reading method needs on every
 * question — the planet-pair table and the special patterns (the team's own
 * list). Matching the question cannot find these: "การงานปีนี้เป็นยังไง" has
 * none of these words, so the pair table was never sent and the method's
 * "ประเมินดาวคู่" step had nothing to read. Kept to the specific names; broad
 * words like เกษตร or อุจจ์ are on nearly every page and would pin everything.
 */
export const DOCTRINE_RULE_TERMS = [
  "ดาวคู่",
  "คู่มิตร",
  "คู่ธาตุ",
  "คู่สมพล",
  "คู่ศัตรู",
  "รูปดวง",
  "เกณฑ์พิเศษ",
  "มาลัยโยค",
  "ดอกพิกุล",
  "จตุสดัย",
  "องค์เกณฑ์",
  "ปทุมเกณฑ์",
  "พินทุบาทว์",
] as const;

/** Share of the doctrine budget reserved for rule definitions. */
const RULES_BUDGET_SHARE = 0.3;

/**
 * Header of the doctrine block. Wording is a hard instruction, not a hint:
 * the admin knowledge base (plus the astrology standards block) is the ONLY
 * interpretation source the model may use — never Gemini's own training.
 */
export const KNOWLEDGE_BLOCK_HEADER =
  "[knowledge] ตำราจากคลังความรู้ของระบบ (แหล่งตีความเพียงแหล่งเดียวที่อนุญาต ยึดข้อมูลดวงปัจจุบันเป็นหลัก):\n\n";

const CHUNK_CHARS = 2_400;
const CHUNK_OVERLAP_CHARS = 180;
const MAX_CHUNKS_PER_DOCUMENT = 3;

const STOP_WORDS = new Set([
  "ของ",
  "และ",
  "หรือ",
  "ที่",
  "ใน",
  "เป็น",
  "จะ",
  "มี",
  "ให้",
  "กับ",
  "จาก",
  "เรื่อง",
  "ดวง",
  "บ้าง",
  "อย่างไร",
  "ยังไง",
  "อะไร",
  "ครับ",
  "ค่ะ",
  "ผม",
  "ฉัน",
  "เรา",
  "the",
  "and",
  "for",
  "with",
]);

function publicText(text: string): string {
  return text
    .replace(/myhora(?:\.com)?/gi, "หลักโหราศาสตร์ไทย")
    .replace(/\bweb[\s-]*scrap(?:e|ed|ing)?\b/gi, "การรวบรวมข้อมูล")
    .replace(/\bscrap(?:e|ed|ing)?\b/gi, "การรวบรวมข้อมูล")
    .replace(/\bfallback\b/gi, "แนวทางสำรอง");
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase("th-TH");
}

function terms(text: string): string[] {
  const normalized = normalize(text);
  const segmented: string[] = [];
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("th", { granularity: "word" });
    for (const part of segmenter.segment(normalized)) {
      if (part.isWordLike) segmented.push(part.segment);
    }
  } else {
    segmented.push(...(normalized.match(/[\p{L}\p{N}]+/gu) ?? []));
  }

  return [
    ...new Set(
      segmented.filter(
        (term) => term.length >= 2 && !STOP_WORDS.has(term),
      ),
    ),
  ].slice(0, 40);
}

function findChunkEnd(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length;
  const earliest = start + Math.floor(CHUNK_CHARS * 0.62);
  for (let i = hardEnd - 1; i >= earliest; i -= 1) {
    if (/\s|[.!?。！？;:]/u.test(text[i] ?? "")) return i + 1;
  }
  return hardEnd;
}

/** Split every enabled document into bounded, slightly overlapping candidates. */
export function chunkKnowledgeDocuments(
  docs: KnowledgeSourceDoc[],
): RetrievedKnowledgeChunk[] {
  const chunks: RetrievedKnowledgeChunk[] = [];
  docs.forEach((doc, docIndex) => {
    const content = publicText(doc.content).replace(/\r\n?/g, "\n").trim();
    if (!content) return;
    const pieces: string[] = [];
    let start = 0;
    while (start < content.length) {
      const end = findChunkEnd(
        content,
        start,
        Math.min(content.length, start + CHUNK_CHARS),
      );
      const piece = content.slice(start, end).trim();
      if (piece) pieces.push(piece);
      if (end >= content.length) break;
      start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS);
    }

    const documentId = doc.id ?? `doc-${docIndex}`;
    pieces.forEach((contentPiece, chunkIndex) => {
      chunks.push({
        documentId,
        title: publicText(doc.title),
        content: contentPiece,
        chunkIndex,
        chunkCount: pieces.length,
        score: 0,
        sortOrder: doc.sortOrder ?? docIndex,
      });
    });
  });
  return chunks;
}

function occurrences(text: string, term: string): number {
  let count = 0;
  let cursor = 0;
  while (count < 4) {
    const found = text.indexOf(term, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + term.length;
  }
  return count;
}

function rankChunk(
  chunk: RetrievedKnowledgeChunk,
  queryTerms: string[],
  contextTerms: string[],
  categoryMatches: boolean,
): number {
  const title = normalize(chunk.title);
  const content = normalize(chunk.content);
  let score = categoryMatches ? 4 : 0;
  let queryMatches = 0;

  for (const term of queryTerms) {
    const titleHits = occurrences(title, term);
    const contentHits = occurrences(content, term);
    if (titleHits + contentHits > 0) queryMatches += 1;
    score += titleHits * 12 + contentHits * 3;
  }
  if (queryTerms.length > 0) {
    score += (queryMatches / queryTerms.length) * 10;
  }

  for (const term of contextTerms) {
    score += occurrences(title, term) * 4 + occurrences(content, term);
  }

  // The opening chunk usually defines the source's subject and is the safest
  // fallback when two sections have equal lexical evidence.
  if (chunk.chunkIndex === 0) score += 0.25;
  return score;
}

/** Rank chunks from the whole eligible corpus, with a diversity cap per source. */
export function retrieveKnowledgeChunks(
  docs: KnowledgeSourceDoc[],
  input: KnowledgeRetrievalInput,
): RetrievedKnowledgeChunk[] {
  const queryTerms = terms(input.query);
  const contextTerms = terms(input.context ?? "").filter(
    (term) => !queryTerms.includes(term),
  );
  const categoryByDocument = new Map(
    docs.map((doc, index) => [
      doc.id ?? `doc-${index}`,
      Boolean(input.categoryId && doc.categoryId === input.categoryId),
    ]),
  );
  const ranked = chunkKnowledgeDocuments(docs)
    .map((chunk) => ({
      ...chunk,
      score: rankChunk(
        chunk,
        queryTerms,
        contextTerms,
        categoryByDocument.get(chunk.documentId) ?? false,
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.sortOrder - b.sortOrder ||
        a.chunkIndex - b.chunkIndex,
    );

  const maxChars = input.maxChars ?? KNOWLEDGE_MAX_CHARS;
  let used = KNOWLEDGE_BLOCK_HEADER.length;
  const perDocument = new Map<string, number>();
  const selected: RetrievedKnowledgeChunk[] = [];
  const taken = new Set<RetrievedKnowledgeChunk>();

  const take = (chunk: RetrievedKnowledgeChunk, limit: number, pinned: boolean) => {
    if (taken.has(chunk)) return;
    if ((perDocument.get(chunk.documentId) ?? 0) >= MAX_CHUNKS_PER_DOCUMENT) return;
    const label = `## ${chunk.title} · ส่วน ${chunk.chunkIndex + 1}/${chunk.chunkCount}\n`;
    const blockChars = label.length + chunk.content.length + (selected.length ? 2 : 0);
    if (used + blockChars > limit) return;
    selected.push(pinned ? { ...chunk, pinned: true } : chunk);
    taken.add(chunk);
    used += blockChars;
    perDocument.set(
      chunk.documentId,
      (perDocument.get(chunk.documentId) ?? 0) + 1,
    );
  };

  // 1. Rule definitions first, inside their own share of the budget: the
  //    passages naming the most distinct rule terms win.
  const rulesLimit = used + Math.floor((maxChars - used) * RULES_BUDGET_SHARE);
  const ruleChunks = ranked
    .map((chunk) => {
      const text = normalize(`${chunk.title}\n${chunk.content}`);
      const named = DOCTRINE_RULE_TERMS.filter((term) => text.includes(term));
      const hits = named.reduce((n, term) => n + occurrences(text, term), 0);
      return { chunk, distinct: named.length, hits };
    })
    .filter((r) => r.distinct > 0)
    .sort((a, b) => b.distinct - a.distinct || b.hits - a.hits);
  for (const { chunk } of ruleChunks) take(chunk, rulesLimit, true);

  // 2. The rest of the budget goes to what matches the question, as before.
  for (const chunk of ranked) take(chunk, maxChars, false);

  return selected;
}

export function buildKnowledgePrompt(
  docs: KnowledgeSourceDoc[],
  input: KnowledgeRetrievalInput,
): string | undefined {
  return buildKnowledgePromptWithTrace(docs, input).prompt;
}

/** Same as buildKnowledgePrompt, plus which chunks made the cut (for the reading trace). */
export function buildKnowledgePromptWithTrace(
  docs: KnowledgeSourceDoc[],
  input: KnowledgeRetrievalInput,
): { prompt: string | undefined; chunks: RetrievedKnowledgeChunk[]; usedChars: number } {
  if (docs.length === 0) return { prompt: undefined, chunks: [], usedChars: 0 };
  const selected = retrieveKnowledgeChunks(docs, input);
  if (selected.length === 0) return { prompt: undefined, chunks: [], usedChars: 0 };
  const prompt =
    KNOWLEDGE_BLOCK_HEADER +
    selected
      .map(
        (chunk) =>
          `## ${chunk.title} · ส่วน ${chunk.chunkIndex + 1}/${chunk.chunkCount}\n${chunk.content}`,
      )
      .join("\n\n");
  return { prompt, chunks: selected, usedChars: prompt.length };
}
