import { describe, expect, it } from "vitest";
import {
  matchWheelInput,
  normalizeThaiDigits,
  wheelInputDisplay,
} from "@/lib/wheel-input";

const days = [
  { value: "", label: "—" },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

const months = [
  { value: "", label: "—" },
  { value: "มกราคม", label: "ม.ค." },
  { value: "กุมภาพันธ์", label: "ก.พ." },
  { value: "มีนาคม", label: "มี.ค." },
  { value: "เมษายน", label: "เม.ย." },
  { value: "พฤษภาคม", label: "พ.ค." },
  { value: "มิถุนายน", label: "มิ.ย." },
  { value: "กรกฎาคม", label: "ก.ค." },
  { value: "สิงหาคม", label: "ส.ค." },
  { value: "กันยายน", label: "ก.ย." },
  { value: "ตุลาคม", label: "ต.ค." },
  { value: "พฤศจิกายน", label: "พ.ย." },
  { value: "ธันวาคม", label: "ธ.ค." },
];

const years = [
  { value: "", label: "—" },
  { value: "2569", label: "2569" },
  { value: "2519", label: "2519" },
  { value: "2490", label: "2490" },
];

describe("matchWheelInput", () => {
  it("jumps to a far-back year without scrolling", () => {
    expect(matchWheelInput("2490", years)).toBe("2490");
    expect(matchWheelInput("๒๔๙๐", years)).toBe("2490");
  });

  it("waits while a year prefix is still ambiguous", () => {
    expect(matchWheelInput("25", years)).toBeNull();
  });

  it("accepts day 2 exactly, not only 20–29", () => {
    expect(matchWheelInput("2", days)).toBe("2");
    expect(matchWheelInput("02", days)).toBe("2");
  });

  it("accepts month by number, abbreviation, or name", () => {
    expect(matchWheelInput("1", months)).toBe("มกราคม");
    expect(matchWheelInput("ม.ค.", months)).toBe("มกราคม");
    expect(matchWheelInput("มกรา", months)).toBe("มกราคม");
  });

  it("clears on empty and shows the selected label", () => {
    expect(matchWheelInput("  ", years)).toBe("");
    expect(wheelInputDisplay("2519", years)).toBe("2519");
    expect(wheelInputDisplay("มกราคม", months)).toBe("ม.ค.");
  });
});

describe("normalizeThaiDigits", () => {
  it("turns Thai digits into Arabic numerals", () => {
    expect(normalizeThaiDigits("๒๕๑๙")).toBe("2519");
  });
});
