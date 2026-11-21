import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The in-article "Launch your GTM campaign from WhatsApp" call box: our AI is
// Distry (Sophie retired), and the button text must read on WhatsApp green.
// White on #25d366 measured 1.98:1 (fails WCAG AA); navy #0f172a is 9.0:1.
const dir = "content/blog";
const articles = readdirSync(dir)
  .map((slug) => join(dir, slug, "article.html"))
  .filter((p) => existsSync(p))
  .map((p) => ({ p, html: readFileSync(p, "utf8") }));

describe("blog WhatsApp call box", () => {
  it("no hand-written article names Sophie", () => {
    for (const { p, html } of articles) expect(html, p).not.toMatch(/Sophie/);
  });

  it("no button puts white text on WhatsApp green", () => {
    for (const { p, html } of articles) {
      expect(html, p).not.toMatch(/background:#25d366;color:#fff/i);
    }
  });

  it("the ai-gtm call box names Distry with readable button text", () => {
    const html = readFileSync(join(dir, "ai-gtm", "article.html"), "utf8");
    expect(html).toContain("Distry, our AI agent,");
    expect(html).toContain("background:#25d366;color:#0f172a");
    expect(html).toContain(">Click here to WhatsApp Distry</a>");
  });
});
