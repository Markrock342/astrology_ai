import path from "node:path";
import { expect, test } from "@playwright/test";
// Same real-component + application-CSS harness as the admin browser tests.
import { startAdminUiHarness } from "../scripts/lib/admin-ui-harness.mjs";

const root = process.cwd();
const birth = { day: 2, month: 1, year: 1977, time: "12:00", country: "ไทย", province: "กรุงเทพมหานคร", district: "วัฒนา" };
// Synthetic, fixed evidence. Never scrape MyHora, call AI, or load a member.
const cells = [
  [{ house: "ตนุ", planetNum: 8, ageRange: "0 - 8.4 ปี" }, { house: "สหัชชะ", planetNum: 3, ageRange: "25 - 33.4 ปี" }, { house: "พันธุ", planetNum: 6, ageRange: "50 - 58.4 ปี" }, { house: "อริ", planetNum: 2, ageRange: "75 - 83.4 ปี" }],
  [{ house: "กดุมภะ", planetNum: 5, ageRange: "8.4 - 16.8 ปี" }, { house: "สหัสชะ", planetNum: 9, ageRange: "33.4 - 41.8 ปี" }, { house: "ปุตตะ", planetNum: 4, ageRange: "58.4 - 66.8 ปี" }, { house: "มรณะ", planetNum: 0, ageRange: "83.4 - 91.8 ปี" }],
  [{ house: "กัมมะ", planetNum: 3, ageRange: "16.8 - 25 ปี" }, { house: "ลาภะ", planetNum: 5, ageRange: "41.8 - 50 ปี" }, { house: "ปัตนิ", planetNum: 1, ageRange: "66.8 - 75 ปี" }, { house: "วินาศ", planetNum: 7, ageRange: "91.8 - 100 ปี" }],
  [null, null, null, null],
];

test("Thai planet labels, Triwai and Taksa retain their reviewed layout", async ({}, testInfo) => {
  const harness = await startAdminUiHarness({
    systemBrowserFallback: false,
    imports: `import {EvidenceGrid} from '${path.join(root, "src/components/app/horoscope-chart-panel")}';import {TaksaNineGrid} from '${path.join(root, "src/components/app/taksa-nine-grid")}';`,
    render: `<main className="mx-auto max-w-5xl p-4"><section data-testid="triwai"><EvidenceGrid title="ตรีวัย" kind="triwai" cells={${JSON.stringify(cells)}}/></section><section className="mt-6 grid gap-6 sm:grid-cols-2"><TaksaNineGrid input={${JSON.stringify(birth)}} mode="natal"/><TaksaNineGrid input={${JSON.stringify(birth)}} mode="transit" asOf={new Date('2028-12-31T05:00:00Z')}/></section></main>`,
  });
  const { page, errors } = harness;
  try {
    await page.setViewportSize(testInfo.project.use.viewport!);
    await page.goto(harness.origin);
    await page.evaluate((theme: string) => { document.documentElement.dataset.theme = theme; }, testInfo.project.use.colorScheme ?? "dark");
    await page.locator("main").waitFor();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('12px "Noto Sans Thai Variable"', "พฤหัสบดี"))).toBe(true);
    expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family.includes("Noto Sans Thai") && font.status === "loaded"))).toBe(true);
    const triwai = page.getByTestId("triwai");
    for (const name of ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "ราหู", "เกตุ", "มฤตยู"]) {
      await expect(triwai.getByText(name, { exact: true }).first()).toBeVisible();
    }
    for (const numeral of "๐๑๒๓๔๕๖๗๘๙") await expect(triwai.getByText(numeral, { exact: true }).first()).toBeVisible();
    await expect(triwai).not.toContainText(/[☉☽♂☿♃♀♄☊☋♅]/u);
    for (const stage of ["วัยต้น", "วัยกลาง", "วัยปลาย", "วัยเทียบ", "ตนุเศษ"]) await expect(triwai.getByText(stage, { exact: true })).toBeVisible();
    await expect(page.getByText("อายุย่างเข้า ๕๒", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await triwai.evaluate((el: HTMLElement) => Array.from(el.querySelectorAll("span")).every(span => span.scrollWidth <= span.clientWidth + 1))).toBe(true);
    expect(errors).toEqual([]);
    // Test-only fault injection proves that a visible regression fails the gate.
    if (process.env.CHART_VISUAL_MUTATION === "1") await page.addStyleTag({ content: "main { filter: grayscale(1) }" });
    await expect(page.locator("main")).toHaveScreenshot("charts.png");
  } finally {
    if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) await testInfo.attach("chart-failure", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await harness.close();
  }
});
