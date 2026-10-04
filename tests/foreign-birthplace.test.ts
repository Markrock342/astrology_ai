import { describe, expect, it } from "vitest";
import { resolveForeignPlace, utcOffsetMinutesAt } from "@/lib/foreign-places";
import { resolvePlaceCoords } from "@/server/horoscope/engine/newhora/data/placeCoordinates";
import { birthProfileSchema } from "@/lib/schemas";

// QA 2026-10-04: every birth outside Thailand was computed at Bangkok, UTC+7.
describe("births outside Thailand", () => {
  it("places a Yangon birth at Yangon, UTC+6:30", () => {
    const p = resolvePlaceCoords("เมียนมา", "Yangon", "", { year: 1990, month: 5, day: 1, time: "10:00" });
    expect(p.lat).toBeCloseTo(16.84, 1);
    expect(p.utcOffsetMinutes).toBe(390);
  });

  it("falls back to the capital for a neighbour country", () => {
    expect(resolvePlaceCoords("ลาว", "แขวงที่ไม่รู้จัก", "", { year: 2000, month: 1, day: 1 }).lon).toBeCloseTo(102.63, 1);
  });

  it("uses the daylight-saving offset in force on the birth date", () => {
    const summer = resolvePlaceCoords("อื่น ๆ", "California", "Los Angeles", { year: 1995, month: 7, day: 4, time: "08:30" });
    const winter = resolvePlaceCoords("อื่น ๆ", "California", "Los Angeles", { year: 1995, month: 1, day: 4, time: "08:30" });
    expect(summer.utcOffsetMinutes).toBe(-420);
    expect(winter.utcOffsetMinutes).toBe(-480);
    expect(utcOffsetMinutesAt("Australia/Sydney", 2001, 1, 15)).toBe(660);
  });

  it("prefers the city to the country and the longest name", () => {
    expect(resolveForeignPlace("อื่น ๆ", "ญี่ปุ่น", "Osaka")?.tz).toBe("Asia/Tokyo");
    expect(resolveForeignPlace("อื่น ๆ", "ญี่ปุ่น", "Osaka")?.lat).toBeCloseTo(34.69, 1);
    expect(resolveForeignPlace("อื่น ๆ", "New York", "")?.lon).toBeCloseTo(-74.0, 1);
  });

  it("refuses to save a place it cannot place, instead of guessing Bangkok", () => {
    const base = { year: 1990, month: 5, day: 1, hour: 10, minute: 0, birthCountry: "อื่น ๆ" };
    expect(birthProfileSchema.safeParse({ ...base, birthProvince: "Nowhere", birthDistrict: "Atlantis" }).success).toBe(false);
    expect(birthProfileSchema.safeParse({ ...base, birthProvince: "California", birthDistrict: "Los Angeles" }).success).toBe(true);
  });

  it("leaves Thai births as they were", () => {
    expect(resolvePlaceCoords("ไทย", "กรุงเทพมหานคร", "พระนคร").utcOffsetMinutes).toBe(420);
  });
});
