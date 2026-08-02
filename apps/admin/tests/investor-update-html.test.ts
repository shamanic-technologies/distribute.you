import { describe, it, expect } from "vitest";
import {
  renderInvestorUpdatePreviewHtml,
  investorUpdateBlocker,
  imageMarkdown,
  imageUrlProblem,
} from "../src/lib/investor-update-html";

describe("renderInvestorUpdatePreviewHtml", () => {
  it("renders with the producer's options — gfm tables and breaks — so the preview is the email", () => {
    const html = renderInvestorUpdatePreviewHtml("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("treats a single newline as a line break, matching breaks: true", () => {
    expect(renderInvestorUpdatePreviewHtml("one\ntwo")).toContain("<br>");
  });

  it("carries NO inline styles — the sender emits bare markup, so styling here would show an email nobody receives", () => {
    const html = renderInvestorUpdatePreviewHtml("# Title\n\nCopy.");
    expect(html).not.toContain("style=");
  });

  it("adds no unsubscribe footer — the gateway appends the real one, and a second would duplicate it", () => {
    const html = renderInvestorUpdatePreviewHtml("hello");
    expect(html).not.toContain("pm:unsubscribe");
    expect(html.toLowerCase()).not.toContain("unsubscribe");
  });

  it("renders headings, bold, lists, links and images", () => {
    const html = renderInvestorUpdatePreviewHtml("## H\n\n**b** [l](https://x.com)\n\n- one\n\n![a](https://x.com/a.png)");
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>");
    expect(html).toContain("<li>");
    expect(html).toContain('href="https://x.com"');
    expect(html).toContain('src="https://x.com/a.png"');
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
