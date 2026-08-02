import { describe, it, expect } from "vitest";
import {
  renderInvestorUpdateHtml,
  renderInvestorUpdateText,
  investorUpdateBlocker,
  imageMarkdown,
  UNSUBSCRIBE_TOKEN,
} from "../src/lib/investor-update-html";

describe("renderInvestorUpdateHtml", () => {
  it("inlines every style — Gmail strips <style> and <head>, so a stylesheet would render only in the preview", () => {
    const html = renderInvestorUpdateHtml("# Title\n\nSome copy.");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<head");
    expect(html).toMatch(/<h1 style="/);
    expect(html).toMatch(/<p style="/);
  });

  it("carries the unsubscribe footer on every update, with no way for the author to omit it", () => {
    for (const md of ["hello", "# just a heading", ""]) {
      const html = renderInvestorUpdateHtml(md);
      expect(html).toContain(UNSUBSCRIBE_TOKEN);
      expect(html).toContain("Unsubscribe");
    }
  });

  it("keeps the footer quiet rather than prominent", () => {
    const html = renderInvestorUpdateHtml("hi");
    expect(html).toMatch(/font-size:12px[^"]*color:#9ca3af/);
  });

  it("renders an inline image", () => {
    const html = renderInvestorUpdateHtml(imageMarkdown("https://x.com/a.png", "A chart"));
    expect(html).toContain('src="https://x.com/a.png"');
    expect(html).toContain('alt="A chart"');
    expect(html).toMatch(/<img[^>]*style="[^"]*max-width:100%/);
  });

  it("bounds the column so a phone never scrolls sideways", () => {
    expect(renderInvestorUpdateHtml("hi")).toContain("max-width:640px");
  });

  it("renders links, lists and bold through the shared converter", () => {
    const html = renderInvestorUpdateHtml("- one\n- two\n\n**bold** and [a link](https://x.com)");
    expect(html).toMatch(/<ul style="/);
    expect(html).toContain("<li");
    expect(html).toMatch(/<strong style="/);
    expect(html).toContain('href="https://x.com"');
  });

  it("leaves a hand-written style on an element alone", () => {
    const html = renderInvestorUpdateHtml('<p style="color:red">mine</p>');
    expect(html).toContain('style="color:red"');
  });
});

describe("renderInvestorUpdateText", () => {
  it("strips markdown syntax", () => {
    const text = renderInvestorUpdateText("# Title\n\n**bold** and *italic*");
    expect(text).toContain("Title");
    expect(text).not.toContain("#");
    expect(text).not.toContain("**");
  });

  it("keeps a link's destination, which is the whole point of a text part", () => {
    expect(renderInvestorUpdateText("[a link](https://x.com)")).toContain("https://x.com");
  });

  it("carries the same unsubscribe token as the HTML part", () => {
    expect(renderInvestorUpdateText("hi")).toContain(UNSUBSCRIBE_TOKEN);
  });
});

describe("imageMarkdown", () => {
  it("assembles the markdown so no caller hand-writes the syntax", () => {
    expect(imageMarkdown(" https://x.com/a.png ", " A chart ")).toBe("![A chart](https://x.com/a.png)");
  });
});

describe("investorUpdateBlocker", () => {
  it("blocks an empty subject", () => {
    expect(investorUpdateBlocker("   ", "body")).toBe("Add a subject.");
  });

  it("blocks an empty body", () => {
    expect(investorUpdateBlocker("Subject", "  \n ")).toBe("Write the update.");
  });

  it("clears once both are written", () => {
    expect(investorUpdateBlocker("Q3 update", "We shipped a lot.")).toBeNull();
  });
});
