import { describe, it, expect } from "vitest";
import {
  renderInvestorUpdateHtml,
  renderInvestorUpdateText,
  investorUpdateBlocker,
  imageMarkdown,
  imageUrlProblem,
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

describe("imageUrlProblem", () => {
  it("refuses SVG — it renders in the composer preview and shows alt text in Gmail", () => {
    // The failure that prompted this: a verification send used an SVG logo and
    // landed as a broken-image placeholder.
    const problem = imageUrlProblem("https://distribute.you/logo-distribute.svg");
    expect(problem).toContain("SVG");
    expect(problem).toContain("PNG");
  });

  it("refuses a relative path — nothing resolves it once the HTML is in a mail client", () => {
    expect(imageUrlProblem("/brand/icon.png")).toContain("https://");
  });

  it("refuses plain http, which clients block", () => {
    expect(imageUrlProblem("http://x.com/a.png")).toContain("https://");
  });

  it("refuses a data URI, which Gmail strips", () => {
    expect(imageUrlProblem("data:image/png;base64,AAAA")).toContain("Gmail");
  });

  it("asks for something when the box is empty", () => {
    expect(imageUrlProblem("   ")).toBe("Paste an image URL.");
  });

  it("accepts an https PNG or JPG, query string and all", () => {
    for (const u of [
      "https://distribute.you/brand/icon.png",
      "https://x.com/a.JPG",
      "https://x.com/a.jpeg?w=800&v=2",
      "https://cdn.x.com/img/chart.gif",
    ]) {
      expect(imageUrlProblem(u)).toBeNull();
    }
  });

  it("judges the path, not the query, so a ?v=.svg cache-buster is not mistaken for an SVG", () => {
    expect(imageUrlProblem("https://x.com/a.png?ref=.svg")).toBeNull();
  });
});
