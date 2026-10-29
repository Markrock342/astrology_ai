import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SocialFollowLinks, SocialLinksProvider } from "@/components/app/social-follow-links";
import type { CmsFooterLink } from "@/lib/cms-keys";

function render(links: CmsFooterLink[], menu = false) {
  return renderToStaticMarkup(createElement(
    SocialLinksProvider,
    { links },
    createElement(SocialFollowLinks, { menu }),
  ));
}

describe("published social links in the app", () => {
  it.each([false, true])("renders CMS links safely (menu=%s)", (menu) => {
    const html = render([{ label: "Facebook", href: "https://www.facebook.com/horasard" }], menu);
    expect(html).toContain("สอบถามข้อมูล และติดตามได้ทาง :");
    expect(html).toContain('href="https://www.facebook.com/horasard"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Facebook (เปิดแท็บใหม่)");
  });

  it("renders nothing when no social link is configured", () => {
    expect(render([])).toBe("");
    expect(renderToStaticMarkup(createElement(SocialFollowLinks))).toBe("");
  });

  it("uses edited CMS labels and URLs without hardcoding Facebook", () => {
    const html = render([{ label: "ติดต่อทีมงาน", href: "https://example.com/new-page" }]);
    expect(html).toContain("ติดต่อทีมงาน");
    expect(html).toContain('href="https://example.com/new-page"');
    expect(html).not.toContain("facebook.com");
  });

  it("ignores unsafe, incomplete and relative legacy values", () => {
    expect(render([
      { label: "Bad", href: "javascript:alert(1)" },
      { label: "Bad", href: "data:text/html,hello" },
      { label: "Bad", href: "//example.com" },
      { label: "Bad", href: "/contact" },
      { label: " ", href: "https://example.com" },
    ])).toBe("");
  });

  it("supports multiple configured social links", () => {
    const html = render([
      { label: "Facebook", href: "https://facebook.com/horasard" },
      { label: "LINE", href: "https://line.me/example" },
    ]);
    expect(html.match(/<a /g)).toHaveLength(2);
  });
});
