import type { ChartJson } from "@/types/chart";

/** Turn chartJson into Thai text for the AI user prompt. */
export function formatChartForPrompt(chart: ChartJson): string {
  const lines = [
    "พื้นดวงเดิม (คำนวณตามหลักโหรไทยสุริยยาตร์ — ใช้ประกอบการตอบ):",
    `- ลัคนา (ราศีจักร): ${chart.chart?.lagna ?? chart.meta.lagna ?? "—"}`,
    `- แหล่งคำนวณ: ${chart.meta.calculationSource ?? "formula"}`,
    "",
    "ตำแหน่งดาว (สถิตรราศี):",
    ...chart.planets.map((p) => {
      const deg = p.degreeText ? ` (${p.degreeText})` : "";
      return `- ${p.planet}: ${p.siderealSign}${deg}`;
    }),
  ];

  if (chart.chart?.taksa?.length) {
    lines.push("", "ทักษา (สรุป):");
    for (const t of chart.chart.taksa.slice(0, 6)) {
      lines.push(`- ${t.taksa}: ${t.sign}`);
    }
  }

  return lines.join("\n");
}
