import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { startAdminUiHarness } from "./lib/admin-ui-harness.mjs";

const artifacts = path.resolve(process.env.ADMIN_UI_ARTIFACT_DIR ?? "output/admin-ui-tests");
await mkdir(artifacts, { recursive: true });
const harness = await startAdminUiHarness({ mockNavigation: true,
  imports: `import {PaymentsPanel} from '${path.join(process.cwd(), "src/components/admin/payments-panel")}';`, render: "<PaymentsPanel/>",
});
const { page, errors } = harness;
const member = { id: "synthetic-member", name: "สมาชิกตัวอย่าง", email: "member@example.invalid" };
const reviewer = { id: "admin-a", name: "ผู้ตรวจตัวอย่าง", email: "admin@example.invalid" };
const receipt = { version: 1, member, reviewer, packageCode: "PACK40", packageName: "แพ็กเดิม 40 คำถาม", amount: 50, decision: "APPROVED", kind: "QUESTION_PACK", questionsAdded: 40, creditsAdded: 0, startsAt: "2026-11-04T05:00:00Z", expiresAt: "2027-02-02T05:00:00Z", expiryRule: { mode: "DAYS", days: 30 }, note: "ตรวจยอดตรงกับสลิป" };
const entry = { id: "frozen-history", reviewedAt: "2026-11-04T05:00:00Z", submittedAt: "2026-11-03T05:00:00Z", transferredAt: "2026-11-03T04:00:00Z", member, reviewer, status: "APPROVED", amount: 50, packageCode: "PACK40", note: receipt.note, selfReview: false, receipt };
let history = [entry, { ...entry, id: "legacy-history", reviewedAt: null, receipt: null }, ...Array.from({ length: 19 }, (_, i) => ({ ...entry, id: `older-${i}`, member: { ...member, name: `สมาชิกย้อนหลัง ${i}` } }))];
let queue = ["A", "B"].map(letter => ({ id: `pending-${letter}`, amount: 50, status: "PENDING", note: null, proofUrl: null, packageCode: "PACK40", createdAt: "2026-11-04T05:00Z", transferredAt: "2026-11-04T04:00Z", user: { ...member, id: `member-${letter}`, name: `Pending Member ${letter}` }, reviewer: null }));
const requests = [], writes = [];
let delayNext = false, releaseOld;
const delayed = new Promise(resolve => { releaseOld = resolve; });
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route(url => url.pathname === "/api/admin/packages", route => route.fulfill({ json: { ok: true, data: [{ code: "PACK40", name: "แพ็กปัจจุบันเปลี่ยนชื่อแล้ว" }] } }));
  await page.route(url => url.pathname === "/api/admin/payments", route => route.fulfill({ json: { ok: true, data: { total: queue.length, page: 1, pageSize: 20, items: queue } } }));
  await page.route(url => url.pathname === "/api/admin/payments/history", async route => {
    const params = new URL(route.request().url()).searchParams; requests.push(Object.fromEntries(params));
    let rows = [...history];
    if (params.get("status")) rows = rows.filter(row => row.status === params.get("status"));
    if (params.get("reviewerId")) rows = rows.filter(row => row.reviewer.id === params.get("reviewerId"));
    const current = Number(params.get("page") || 1);
    const data = { total: rows.length, page: current, pageSize: 20, items: rows.slice((current - 1) * 20, current * 20), reviewers: [reviewer] };
    if (delayNext) { delayNext = false; await delayed; }
    await route.fulfill({ json: { ok: true, data } });
  });
  await page.route(/\/api\/admin\/payments\/pending-[AB]\/review$/, async route => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const body = route.request().postDataJSON(); writes.push(body);
    const pending = queue.find(row => row.id === id); queue = queue.filter(row => row.id !== id);
    history.unshift({ ...entry, id: `history-${id}`, member: pending.user, status: body.status, note: body.note || null,
      receipt: { ...receipt, member: pending.user, decision: body.status, kind: body.status === "REJECTED" ? "REJECTED" : "QUESTION_PACK", questionsAdded: body.status === "REJECTED" ? 0 : 40, note: body.note || null } });
    await route.fulfill({ json: { ok: true, data: { payment: { id, status: body.status } } } });
  });
  await page.goto(harness.origin);
  const region = page.getByRole("region", { name: "ประวัติการดำเนินการ", exact: true });
  await region.getByRole("button", { name: "โหลดประวัติใหม่" }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="payment-history-title"] [aria-busy]')?.getAttribute("aria-busy") === "false");
  const frozen = region.getByRole("row").filter({ hasText: "frozen-history" });
  await frozen.getByText("แพ็กเดิม 40 คำถาม", { exact: true }).waitFor();
  assert.equal(await frozen.getByText("เงื่อนไขแพ็ก 30 วัน", { exact: true }).count(), 1);
  assert.match(await frozen.textContent(), /02\/02\/2027/);
  assert.match(await frozen.textContent(), /\+40 คำถาม/);
  assert.equal(await region.getByRole("row").filter({ hasText: "legacy-history" }).getByText("รายการเดิมไม่ได้บันทึกระยะเวลาไว้", { exact: true }).count(), 1);
  assert.equal(await region.getByRole("row").filter({ hasText: "legacy-history" }).getByText("ไม่ได้บันทึกเวลาตรวจไว้", { exact: true }).count(), 1);
  assert.equal(await region.getByText("แพ็กปัจจุบันเปลี่ยนชื่อแล้ว", { exact: true }).count(), 0);
  console.log("PASS history is below the queue and shows frozen pack, actual expiry, reviewer and explicit legacy gaps");
  await region.getByRole("button", { name: "ประวัติหน้าถัดไป" }).click();
  await region.getByText("หน้า 2/2", { exact: false }).waitFor();
  assert.equal(requests.at(-1).page, "2");
  await region.getByRole("button", { name: "ประวัติหน้าก่อน" }).click();
  await region.getByText("หน้า 1/2", { exact: false }).waitFor();
  await region.getByLabel("ประวัติตั้งแต่วันที่", { exact: true }).fill("04/11/2026");
  await region.getByLabel("ประวัติถึงวันที่", { exact: true }).fill("04/11/2026");
  await region.getByLabel("แอดมินผู้ตรวจประวัติ").selectOption("admin-a");
  await region.getByRole("button", { name: "ค้นหาประวัติ", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="payment-history-title"] [aria-busy]')?.getAttribute("aria-busy") === "false");
  assert.deepEqual({ from: requests.at(-1).from, to: requests.at(-1).to, reviewerId: requests.at(-1).reviewerId }, { from: "2026-11-04", to: "2026-11-04", reviewerId: "admin-a" });
  const before = requests.length;
  await region.getByLabel("ประวัติตั้งแต่วันที่", { exact: true }).fill("31/02/2027");
  await region.getByRole("button", { name: "ค้นหาประวัติ", exact: true }).click();
  await region.getByRole("alert").filter({ hasText: "dd/mm/yyyy" }).waitFor();
  assert.equal(requests.length, before);
  await region.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="payment-history-title"] [aria-busy]')?.getAttribute("aria-busy") === "false");
  console.log("PASS pagination, reviewer/date filters and dd/mm/yyyy validation without extra requests");

  delayNext = true;
  await region.getByRole("button", { name: "โหลดประวัติใหม่" }).click();
  const pendingA = page.getByRole("row").filter({ hasText: "Pending Member A" });
  await pendingA.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await region.getByText("history-pending-A", { exact: true }).waitFor();
  const oldResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/admin/payments/history");
  releaseOld(); await oldResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await region.getByText("history-pending-A", { exact: true }).count(), 1);
  assert.equal(writes.length, 1);
  const pendingB = page.getByRole("row").filter({ hasText: "Pending Member B" });
  await pendingB.getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
  await page.getByText("กรุณาระบุเหตุผลในหมายเหตุก่อนปฏิเสธ", { exact: true }).waitFor(); assert.equal(writes.length, 1);
  await pendingB.getByLabel("หมายเหตุการตรวจ").fill("ยอดเงินไม่ตรงกับสลิป");
  await pendingB.getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
  await region.getByText("history-pending-B", { exact: true }).waitFor();
  await region.getByText("ยอดเงินไม่ตรงกับสลิป", { exact: true }).waitFor();
  await page.getByText("ไม่มีรายการ", { exact: true }).waitFor();
  assert.equal(writes.length, 2);
  console.log("PASS approvals/rejections refresh history; late responses cannot replace it; empty queue keeps history visible");
  await region.evaluate(el => el.scrollIntoView({ block: "start" })); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, "payment-history-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await region.evaluate(el => el.scrollIntoView({ block: "start" }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, "payment-history-mobile.png") });
  assert.deepEqual(errors, []); console.log("PASS desktop/mobile layout without page overflow or browser errors");
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "payment-history-failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally { releaseOld(); await harness.close(); }
