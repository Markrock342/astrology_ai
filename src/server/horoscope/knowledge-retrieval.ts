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
};

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
  const header =
    "ความรู้อ้างอิงที่ค้นพบจากคลังความรู้ (ใช้ประกอบการตอบและยึดข้อมูลดวงปัจจุบันเป็นหลัก):\n\n";
  let used = header.length;
  const perDocument = new Map<string, number>();
  const selected: RetrievedKnowledgeChunk[] = [];

  for (const chunk of ranked) {
    if ((perDocument.get(chunk.documentId) ?? 0) >= MAX_CHUNKS_PER_DOCUMENT) {
      continue;
    }
    const label = `## ${chunk.title} · ส่วน ${chunk.chunkIndex + 1}/${chunk.chunkCount}\n`;
    const blockChars = label.length + chunk.content.length + (selected.length ? 2 : 0);
    if (used + blockChars > maxChars) continue;
    selected.push(chunk);
    used += blockChars;
    perDocument.set(
      chunk.documentId,
      (perDocument.get(chunk.documentId) ?? 0) + 1,
    );
  }

  return selected;
}

export function buildKnowledgePrompt(
  docs: KnowledgeSourceDoc[],
  input: KnowledgeRetrievalInput,
): string | undefined {
  if (docs.length === 0) return undefined;
  const selected = retrieveKnowledgeChunks(docs, input);
  if (selected.length === 0) return undefined;
  const header =
    "ความรู้อ้างอิงที่ค้นพบจากคลังความรู้ (ใช้ประกอบการตอบและยึดข้อมูลดวงปัจจุบันเป็นหลัก):\n\n";
  return (
    header +
    selected
      .map(
        (chunk) =>
          `## ${chunk.title} · ส่วน ${chunk.chunkIndex + 1}/${chunk.chunkCount}\n${chunk.content}`,
      )
      .join("\n\n")
  );
}
