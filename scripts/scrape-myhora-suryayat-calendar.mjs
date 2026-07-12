#!/usr/bin/env node
/**
 * ดึงปฏิทินสุริยยาตร์รายวันจาก myhora → years/{พ.ศ.}.json
 *
 *   node scripts/scrape-myhora-suryayat-calendar.mjs --from 2549 --to 2549
 *   node scripts/scrape-myhora-suryayat-calendar.mjs --from 2484 --to 2583 --concurrency 4
 *
 * หมายเหตุ: หน้าปฏิทินเป็นสมผุส ณ 24:00น. (UTC+06:42) — ไม่ใช่เวลาเกิด
 * lookup ใช้คีย์วัน MM-DD เป็นหลัก; ลัคนา/เวลาเกิดยังพึ่ง formula หรือ scrape thai.aspx
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(
  ROOT,
  "src/server/horoscope/engine/newhora/data/suryayat100/years",
);

const ORIGIN = (process.env.MYHORA_ORIGIN ?? "https://myhora.com").replace(
  /\/$/,
  "",
);

/** รหัสย่อราศี myhora → ชื่อเต็ม (ตรง sign-codes.ts) */
const SIGN_ABBR = {
  มษ: "เมษ",
  พษ: "พฤษภ",
  พภ: "พฤษภ",
  มถ: "มิถุน",
  กฎ: "กรกฎ",
  สห: "สิงห์",
  กย: "กันย์",
  กน: "กันย์",
  ตล: "ตุลย์",
  พจ: "พิจิก",
  ธน: "ธนู",
  มก: "มกร",
  กภ: "กุมภ์",
  มี: "มีน",
  มน: "มีน",
};

const PLANETS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
  "ราหู",
  "เกตุ",
  "มฤตยู",
];

function parseArgs(argv) {
  const out = {
    from: 2540,
    to: 2570,
    concurrency: 4,
    delayMs: 80,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") out.from = Number(argv[++i]);
    else if (a === "--to") out.to = Number(argv[++i]);
    else if (a === "--concurrency") out.concurrency = Number(argv[++i]);
    else if (a === "--delay") out.delayMs = Number(argv[++i]);
    else if (a === "--force") out.force = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/scrape-myhora-suryayat-calendar.mjs [options]
  --from <BE>         start Buddhist year (default 2540)
  --to <BE>           end Buddhist year inclusive (default 2570)
  --concurrency <n>   parallel fetches (default 4)
  --delay <ms>        pause between batches (default 80)
  --force             re-fetch days already present`);
      process.exit(0);
    }
  }
  if (!out.from || !out.to || out.from > out.to) {
    throw new Error("Invalid --from/--to");
  }
  return out;
}

function isLeapCe(ceYear) {
  return (ceYear % 4 === 0 && ceYear % 100 !== 0) || ceYear % 400 === 0;
}

function daysInMonth(beYear, month) {
  const ce = beYear - 543;
  const lengths = [
    31,
    isLeapCe(ce) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return lengths[month - 1];
}

function allDayKeys(beYear) {
  const keys = [];
  for (let month = 1; month <= 12; month++) {
    const max = daysInMonth(beYear, month);
    for (let day = 1; day <= max; day++) {
      keys.push({
        day,
        month,
        key: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      });
    }
  }
  return keys;
}

function abbrToSign(abbr) {
  const key = abbr.trim();
  return SIGN_ABBR[key] ?? key;
}

/** Parse สมผุส table from daily calendar HTML */
export function parseSamputPlanets(html) {
  const sectionIdx = html.indexOf("สมผุส ณ เวลา");
  const slice = sectionIdx >= 0 ? html.slice(sectionIdx, sectionIdx + 8000) : html;
  const planets = {};
  const re =
    /<td[^>]*>\s*(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|ราหู|เกตุ|มฤตยู)\s*<\/td>\s*<td[^>]*>\s*\d+\s*:\s*([^<\s]+)\s*<\/td>/gi;
  let m;
  while ((m = re.exec(slice)) !== null) {
    const planet = m[1].trim();
    const sign = abbrToSign(m[2]);
    planets[planet] = sign;
  }
  for (const p of PLANETS) {
    if (!planets[p] || planets[p] === "—") return null;
  }
  return planets;
}

async function fetchDay(beYear, day, month) {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const url = `${ORIGIN}/calendar/astro-suriyayas-${dd}-${mm}-${beYear}.aspx`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "HoraSard/1.0 (+suryayat-calendar-dump)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();
  const planets = parseSamputPlanets(html);
  if (!planets) throw new Error(`parse failed ${url}`);
  return planets;
}

function loadYear(beYear) {
  const path = join(OUT_DIR, `${beYear}.json`);
  if (!existsSync(path)) {
    return {
      beYear,
      source: `myhora calendar dump ${new Date().toISOString().slice(0, 10)} (24:00 Bangkok UTC+06:42)`,
      days: {},
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveYear(file) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, `${file.beYear}.json`);
  writeFileSync(path, JSON.stringify(file) + "\n", "utf8");
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeYear(beYear, opts) {
  const file = loadYear(beYear);
  const all = allDayKeys(beYear);
  const pending = opts.force
    ? all
    : all.filter((d) => {
        const entry = file.days[d.key];
        return !entry?.planets || Object.keys(entry.planets).length < 10;
      });

  console.log(
    `[${beYear}] need ${pending.length}/${all.length} days (have ${Object.keys(file.days).length})`,
  );
  if (pending.length === 0) return { beYear, ok: all.length, fail: 0 };

  let ok = 0;
  let fail = 0;
  const batchSize = opts.concurrency;

  for (let start = 0; start < pending.length; start += batchSize) {
    const batch = pending.slice(start, start + batchSize);
    await mapPool(batch, opts.concurrency, async (d) => {
      try {
        const planets = await fetchDay(beYear, d.day, d.month);
        file.days[d.key] = { planets };
        ok++;
      } catch (err) {
        fail++;
        console.warn(
          `  fail ${beYear}-${d.key}:`,
          err instanceof Error ? err.message : err,
        );
      }
    });
    // checkpoint every batch
    saveYear(file);
    if (opts.delayMs > 0) await sleep(opts.delayMs);
    if ((start / batchSize) % 20 === 0) {
      console.log(
        `  … ${Math.min(start + batchSize, pending.length)}/${pending.length}`,
      );
    }
  }

  file.source = `myhora calendar dump ${new Date().toISOString().slice(0, 10)} (24:00 Bangkok UTC+06:42)`;
  saveYear(file);
  console.log(`[${beYear}] done ok=${ok} fail=${fail} totalDays=${Object.keys(file.days).length}`);
  return { beYear, ok, fail };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(
    `Scraping BE ${opts.from}–${opts.to} → ${OUT_DIR} (concurrency=${opts.concurrency})`,
  );

  // smoke one day first
  const smoke = await fetchDay(2549, 21, 5);
  console.log("smoke 2549-05-21:", smoke);

  let totalFail = 0;
  for (let y = opts.from; y <= opts.to; y++) {
    const r = await scrapeYear(y, opts);
    totalFail += r.fail;
  }
  if (totalFail > 0) {
    console.error(`Completed with ${totalFail} failures — re-run to resume`);
    process.exit(1);
  }
  console.log("All years complete");
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
