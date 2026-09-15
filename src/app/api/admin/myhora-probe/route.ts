import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { fetchMyhoraThaiChart } from "@/server/horoscope/engine/myhora/fetch-myhora";

/**
 * GET /api/admin/myhora-probe?day=19&month=6&year=2002&time=22:43&province=สกลนคร&district=สว่างแดนดิน
 *
 * Runs the exact scrape the natal builder runs and returns what myhora echoed
 * back (ids submitted, lagna, planets, the date-detail lines with the
 * coordinates it used). Admin-only; for verifying birthplace handling from
 * production, where myhora is reachable.
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const q = new URL(req.url).searchParams;
    const input = {
      day: Number(q.get("day")),
      month: Number(q.get("month")),
      year: Number(q.get("year")),
      time: q.get("time") ?? "12:00",
      country: q.get("country") ?? "ไทย",
      province: q.get("province") ?? "",
      district: q.get("district") ?? "",
    };
    if (!input.day || !input.month || !input.year || !input.province) {
      throw new Error("day, month, year, time, province, district are required");
    }
    const now = new Date();
    const scrape = await fetchMyhoraThaiChart(input, {
      lite: true,
      includeTransit: true,
      transit: {
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        time: "12:00",
        preset: "",
        province: input.province,
        district: input.district,
      },
    });
    const transitLagna = scrape.tables.transitPlanets?.find((row) =>
      row.planet.includes("ลัคนา"),
    );
    return ok({
      input,
      placeIds: scrape.placeIds ?? null,
      lagna: scrape.lagna,
      planets: scrape.planets,
      natalDetail: scrape.tables.dateDetailNatal?.lines.map((line) => line.text) ?? [],
      transitDetail: scrape.tables.dateDetailTransit?.lines.map((line) => line.text) ?? [],
      transitLagna: transitLagna?.zodiac ?? null,
      transitRows: scrape.tables.transitPlanets?.length ?? 0,
    });
  });
}
