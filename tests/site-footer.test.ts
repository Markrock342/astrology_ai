import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CMS_DEFAULTS, CMS_KEYS, type CmsSiteFooter } from "@/lib/cms-keys";

describe("SiteFooter", () => {
  it("keeps a quiet Limitcode design credit next to the copyright", () => {
    const html = renderToStaticMarkup(
      createElement(SiteFooter, {
        footer: CMS_DEFAULTS[CMS_KEYS.siteFooter] as CmsSiteFooter,
      }),
    );

    expect(html).toContain("Design by Limitcode");
    expect(html).toContain("https://limitcode.shop");
    expect(html).not.toMatch(/creat/i);
  });
});
