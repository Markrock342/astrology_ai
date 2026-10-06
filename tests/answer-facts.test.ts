import { describe, expect, it } from "vitest";
import { buildHouseChains, formatHouseLordsForPrompt } from "@/lib/house-chains";
import { findWrongLordClaims } from "@/lib/answer-facts";

// The owner's chart in the 4 Oct chat: lagna กันย์, so กัมมะ (มิถุน) is พุธ's.
const chains = buildHouseChains({
  lagna: "กันย์",
  planets: [
    { planet: "อาทิตย์", siderealSign: "สิงห์" },
    { planet: "จันทร์", siderealSign: "ธนู" },
    { planet: "อังคาร", siderealSign: "เมษ" },
    { planet: "พุธ", siderealSign: "ตุลย์" },
    { planet: "พฤหัสบดี", siderealSign: "มิถุน" },
    { planet: "ศุกร์", siderealSign: "ตุลย์" },
    { planet: "เสาร์", siderealSign: "มกร" },
    { planet: "ราหู", siderealSign: "มิถุน" },
  ],
});

describe("house-lord claims in an answer", () => {
  it("catches the claim the owner saw", () => {
    const answer =
      "ประกอบกับดาวพฤหัสบดี (๕) ซึ่งเป็นดาวเจ้าเรือนกัมมะ (เรือนอาชีพและหน้าที่) ได้ตำแหน่งประ";
    expect(findWrongLordClaims(answer, chains)).toMatchObject([
      { houseName: "กัมมะ", claimed: "พฤหัสบดี", actual: "พุธ" },
    ]);
  });

  it("passes the right ones, either way round", () => {
    const answer =
      "ดาวพุธเป็นดาวเจ้าเรือนตนุ และศุกร์ (๖) เจ้าเรือนกดุมภะ ส่วนเจ้าเรือนกัมมะคือดาวพุธ";
    expect(findWrongLordClaims(answer, chains)).toEqual([]);
  });

  it("puts every house's lord on one line for the prompt", () => {
    const [head, line] = formatHouseLordsForPrompt(chains);
    expect(head).toContain("[house_lords]");
    expect(line).toContain("ภพ 10 กัมมะ (มิถุน) = พุธ");
    expect(line).toContain("ภพ 1 ตนุ (กันย์) = พุธ");
  });
});

describe("ทักษาจร claims in an answer", () => {
  it("catches a planet given someone else's role", async () => {
    const { findWrongTaksaClaims } = await import("@/lib/answer-facts");
    const slots = [{ planet: "ราหู", taksa: "ศรีจร" }, { planet: "พฤหัสบดี", taksa: "มนตรีจร" }];
    expect(findWrongTaksaClaims("ดาวพฤหัสบดี (๕) ซึ่งเป็นศรีจรในปีนี้", slots)).toMatchObject([
      { planet: "พฤหัสบดี", claimed: "ศรีจร", actual: "มนตรีจร" },
    ]);
    expect(findWrongTaksaClaims("ราหูเป็นศรีจร และพฤหัสบดีเป็นมนตรีจร", slots)).toEqual([]);
  });
});
