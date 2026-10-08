"use client";

import { Fragment, useState, type ReactNode } from "react";

/**
 * Astrology terms a reader trips on ("ลัคนา", "ภพกัมมะ", "ตรีโกณ"), explained
 * where they stand. User feedback: the jargon made answers hard to follow.
 * Only unambiguous words are listed — "อายุ" or "ศรี" alone are everyday Thai.
 */
export const ASTRO_GLOSSARY: Record<string, string> = {
  ลัคนา: "จุดขึ้นของดวงตอนเกิด บอกตัวตนและบุคลิกพื้นฐาน",
  ดวงจร: "ตำแหน่งดาวในช่วงเวลาที่ถาม ใช้ดูจังหวะชีวิต",
  ดาวจร: "ดาวที่กำลังเดินอยู่ในช่วงเวลาที่ถาม",
  พื้นดวงเดิม: "ดวงตอนเกิด บอกโครงสร้างชีวิตที่ติดตัว",
  ดวงเดิม: "ดวงตอนเกิด บอกโครงสร้างชีวิตที่ติดตัว",
  เจ้าเรือน: "ดาวที่ดูแลเรื่องของภพนั้น",
  ตนุ: "ภพที่ 1 — ตัวตน บุคลิก สุขภาพ",
  กดุมภะ: "ภพที่ 2 — เงินและทรัพย์สิน",
  สหัชชะ: "ภพที่ 3 — พี่น้อง เพื่อน การติดต่อ เอกสาร",
  พันธุ: "ภพที่ 4 — บ้าน ครอบครัว พ่อแม่",
  ปุตตะ: "ภพที่ 5 — ลูก ความรัก ความคิดสร้างสรรค์",
  อริ: "ภพที่ 6 — อุปสรรค ศัตรู งานประจำ สุขภาพที่ต้องดูแล",
  ปัตนิ: "ภพที่ 7 — คู่ครอง หุ้นส่วน",
  มรณะ: "ภพที่ 8 — การเปลี่ยนแปลงใหญ่ วิกฤต มรดก",
  ศุภะ: "ภพที่ 9 — โชค ผู้ใหญ่อุปถัมภ์ การเดินทางไกล",
  กัมมะ: "ภพที่ 10 — การงาน หน้าที่ ชื่อเสียง",
  ลาภะ: "ภพที่ 11 — รายได้ ลาภ ผลสำเร็จ",
  วินาศ: "ภพที่ 12 — การสูญเสีย เรื่องเบื้องหลัง",
  เกษตร: "ดาวอยู่บ้านตัวเอง มีกำลังดี",
  อุจจ์: "ดาวอยู่ตำแหน่งที่มีกำลังสูงสุด",
  นิจ: "ดาวอยู่ตำแหน่งที่อ่อนกำลัง",
  ตรีโกณ: "ดาวทำมุมเกื้อหนุนกัน",
  จตุโกณ: "ดาวทำมุมตึง ต้องออกแรง",
  ทักษา: "ระบบบอกบทบาทของดาวแต่ละดวงต่อตัวคุณ เช่น ศรี (มงคล) กาลกิณี (อุปสรรค)",
  กาลกิณี: "บทบาทของดาวที่นำอุปสรรค ควรระวัง",
  ศรีจร: "ดาวที่ให้โชคและความราบรื่นในปีนี้",
  มนตรีจร: "ดาวที่ให้ผู้ใหญ่หรือคนช่วยเหลือในปีนี้",
  สมพงษ์: "ความเข้ากันของสองคนตามตำราไทย",
};

// Longest first, so "พื้นดวงเดิม" wins over "ดวงเดิม".
const TERMS = Object.keys(ASTRO_GLOSSARY).sort((a, b) => b.length - a.length);
// "เกษตรกร" (farmer) and "เกษตรศาสตร์" are not the dignity.
const TERM_RE = new RegExp(`(${TERMS.map((t) => (t === "เกษตร" ? "เกษตร(?!กร|กรรม|ศาสตร์)" : t)).join("|")})`, "g");

function Term({ word }: { word: string }) {
  const [open, setOpen] = useState(false);
  const meaning = ASTRO_GLOSSARY[word];
  return (
    <span className="relative inline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        title={meaning}
        aria-label={`${word}: ${meaning}`}
        className="cursor-help underline decoration-[var(--primary)]/60 decoration-dotted underline-offset-4"
      >
        {word}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[12px] leading-5 text-[var(--foreground)] shadow-lg"
        >
          <b className="text-[var(--primary)]">{word}</b> — {meaning}
        </span>
      ) : null}
    </span>
  );
}

function wrapText(text: string, key: string): ReactNode {
  if (!TERM_RE.test(text)) return text;
  TERM_RE.lastIndex = 0;
  return text.split(TERM_RE).map((part, i) =>
    ASTRO_GLOSSARY[part] ? <Term key={`${key}-${i}`} word={part} /> : <Fragment key={`${key}-${i}`}>{part}</Fragment>,
  );
}

/** Wraps glossary terms in plain-text children; elements (bold, links) pass through. */
export function withGlossary(children: ReactNode): ReactNode {
  if (typeof children === "string") return wrapText(children, "g");
  if (Array.isArray(children)) {
    return children.map((child, i) => (typeof child === "string" ? <Fragment key={i}>{wrapText(child, `g${i}`)}</Fragment> : child));
  }
  return children;
}
