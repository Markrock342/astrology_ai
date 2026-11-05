import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { startAdminUiHarness } from "./lib/admin-ui-harness.mjs";
const artifacts = path.resolve(process.env.ADMIN_UI_ARTIFACT_DIR ?? "output/admin-ui-tests");
await mkdir(artifacts, { recursive: true });
const harness = await startAdminUiHarness({ imports: `import {KnowledgeManager} from '${path.join(process.cwd(), "src/components/admin/knowledge-manager")}';`, render: "<KnowledgeManager/>" });
const { page, errors } = harness;
const base = { categoryId: null, category: null, sortOrder: 0, draftUpdatedAt: null, contentChars: 20, content: "ตำราทดสอบของทีม ไม่ใช่ข้อมูลผู้ใช้", draftTitle: null, draftContent: null };
let docs = [
  { ...base, id: "team-fixture", title: "ตำราที่ทีมเพิ่ม", enabled: true, provenance: { source: "TEAM", createdBy: "ผู้เขียนตัวอย่าง", statusChangedAt: "2026-11-05T05:00:00Z", statusChangedBy: "ระบบกู้คืน", statusReason: "กู้คืนตามคำขอเจ้าของ" } },
  { ...base, id: "kb-global-planets", title: "ชุดตั้งต้นตัวอย่าง", enabled: false, provenance: { source: "DEFAULT" } },
  { ...base, id: "kb-team-engine-formulas", title: "คู่มือคำนวณตัวอย่าง", enabled: false, provenance: { source: "SYSTEM_GUIDE" } },
];
const writes = [];
try {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route(url => url.pathname === "/api/admin/categories", r => r.fulfill({ json: { ok: true, data: [] } }));
  await page.route(url => url.pathname === "/api/admin/revisions", r => r.fulfill({ json: { ok: true, data: [] } }));
  await page.route(url => url.pathname === "/api/admin/knowledge", r => {
    assert.equal(r.request().method(), "GET");
    return r.fulfill({ json: { ok: true, data: docs } });
  });
  await page.route(/\/api\/admin\/knowledge\/team-fixture(?:\/publish)?$/, async r => {
    if (r.request().method() !== "GET") {
      const payload = r.request().postDataJSON(); writes.push({ method: r.request().method(), payload });
      docs = docs.map(d => d.id === "team-fixture" ? { ...d, ...payload } : d);
    }
    await r.fulfill({ json: { ok: true, data: docs[0] } });
  });
  await page.goto(harness.origin);
  await page.getByText("ตำราที่ทีมเพิ่ม", { exact: true }).waitFor();
  for (const label of ["เอกสารที่ทีมเพิ่ม", "ชุดความรู้ตั้งต้น", "คู่มือระบบสำหรับทีม"]) await page.getByText(label, { exact: true }).last().waitFor();
  assert.equal(writes.length, 0);
  await page.getByLabel("แหล่งที่มาของเอกสาร").selectOption("TEAM");
  assert.equal(await page.getByText("ชุดตั้งต้นตัวอย่าง", { exact: true }).count(), 0);
  await page.getByLabel("สถานะเอกสารความรู้").selectOption("OFF");
  await page.getByText("ไม่มีเอกสารที่ตรงกับตัวกรอง", { exact: true }).waitFor();
  await page.getByLabel("สถานะเอกสารความรู้").selectOption("ALL");
  console.log("PASS source and status labels/filters distinguish team knowledge, defaults and the system guide without mutations");
  await page.getByRole("button", { name: "ปิดการอ้างอิง ตำราที่ทีมเพิ่ม", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก", exact: true }).click(); assert.equal(writes.length, 0);
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await page.getByRole("textbox", { name: "ชื่อเอกสาร", exact: true }).waitFor();
  await page.getByRole("button", { name: "ปิดการอ้างอิง ตำราที่ทีมเพิ่ม", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ยืนยันปิดการอ้างอิง", exact: true }).click();
  await page.getByRole("button", { name: "เปิดการอ้างอิง ตำราที่ทีมเพิ่ม", exact: true }).waitFor();
  await page.getByRole("button", { name: "เผยแพร่", exact: true }).last().click();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll("button")).some(b => b.textContent === "กำลังบันทึก…"));
  assert.equal(writes.at(-1).payload.enabled, false);
  assert.equal(writes.at(-1).payload.content, base.content);
  console.log("PASS cancellation sends no mutation and publishing an open editor cannot undo its own confirmed toggle");
  await page.getByRole("button", { name: "เปิดการอ้างอิง ตำราที่ทีมเพิ่ม", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ยืนยันเปิดการอ้างอิง", exact: true }).click();
  await page.getByRole("button", { name: "ปิดการอ้างอิง ตำราที่ทีมเพิ่ม", exact: true }).waitFor();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await page.getByLabel("แหล่งที่มาของเอกสาร").selectOption("ALL");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, "knowledge-sources-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, "knowledge-sources-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []); console.log("PASS desktop/mobile knowledge manager without page overflow or browser errors");
} catch (e) { await page.screenshot({ path: path.join(artifacts, "knowledge-failure.png"), fullPage: true }).catch(() => {}); throw e; }
finally { await harness.close(); }
