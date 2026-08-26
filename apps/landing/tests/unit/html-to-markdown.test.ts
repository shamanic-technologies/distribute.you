import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  extractDescription,
  extractTitle,
  htmlToMarkdown,
} from "@/lib/html-to-markdown";

const PAGE = `<!DOCTYPE html>
<html lang="en"><head>
<title>Cost guide</title>
<meta name="description" content="What a qualified lead costs.">
<style>.x{color:red}</style>
<script>window.boot = 1;</script>
</head>
<body class="page-guide">
<div id="site-nav"></div>
<script src="js/components.js"></script>
<header><nav><a href="/pricing">Pricing</a></nav></header>
<section>
  <h1>Cost guide</h1>
  <p>Agencies charge <strong>a retainer</strong> and an <em>extra</em> per reply.</p>
  <svg viewBox="0 0 10 10"><path d="M0 0"/><text>Decorative</text></svg>
  <ul><li>Agency</li><li>In-house SDR</li></ul>
  <table>
    <thead><tr><th>Channel</th><th>Monthly</th></tr></thead>
    <tbody><tr><td>Agency</td><td>$3,000</td></tr></tbody>
  </table>
  <p>Read the <a href="/pricing">pricing page</a> or <a href="#top">jump up</a>.</p>
  <blockquote>Measured, not quoted.</blockquote>
  <pre><code>curl https://api.distribute.you/openapi.json</code></pre>
</section>
<footer><a href="/terms">Terms</a></footer>
<div id="site-footer"></div>
</body></html>`;

describe("htmlToMarkdown", () => {
  const md = htmlToMarkdown(PAGE, {
    baseUrl: "https://distribute.you",
    canonicalUrl: "https://distribute.you/cold-email-cost-guide",
  });

  it("opens with the document title and the canonical URL", () => {
    expect(md.startsWith("# Cost guide\n")).toBe(true);
    expect(md).toContain("> Source: https://distribute.you/cold-email-cost-guide");
    expect(md).toContain("What a qualified lead costs.");
  });

  it("does not repeat the title as a body heading", () => {
    expect(md.match(/# Cost guide/g)).toHaveLength(1);
  });

  it("drops script, style, svg, nav, header and footer", () => {
    expect(md).not.toContain("window.boot");
    expect(md).not.toContain("color:red");
    expect(md).not.toContain("Decorative");
    expect(md).not.toContain("Terms");
    expect(md).not.toContain("viewBox");
  });

  it("leaves no HTML tag behind", () => {
    expect(md).not.toMatch(/<[a-z/][^>]*>/i);
  });

  it("converts emphasis, lists and blockquotes", () => {
    expect(md).toContain("**a retainer**");
    expect(md).toContain("*extra*");
    expect(md).toContain("- Agency");
    expect(md).toContain("- In-house SDR");
    expect(md).toContain("> Measured, not quoted.");
  });

  it("converts a table with a header separator", () => {
    expect(md).toContain("| Channel | Monthly |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| Agency | $3,000 |");
  });

  it("keeps a fenced code block", () => {
    expect(md).toContain("```\ncurl https://api.distribute.you/openapi.json\n```");
  });

  it("resolves a root-relative link and keeps a same-page anchor as plain text", () => {
    expect(md).toContain("[pricing page](https://distribute.you/pricing)");
    expect(md).toContain("jump up");
    expect(md).not.toContain("](#top)");
  });

  it("leaves no line indented, so nothing reads as preformatted", () => {
    const lines = md.split("\n").filter((line) => !line.startsWith("```"));
    expect(lines.some((line) => /^\s+\S/.test(line))).toBe(false);
  });

  it("never leaves three consecutive newlines", () => {
    expect(md).not.toContain("\n\n\n");
  });
});

describe("entity decoding", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("R&amp;D &#39;now&#39; &#x2192; later")).toBe(
      `R&D 'now' ${String.fromCharCode(0x2192)} later`,
    );
    // The accented street name on the about page round-trips.
    expect(decodeEntities("rue de l'&Eacute;glise")).toBe("rue de l'Église");
  });

  it("decodes the typographic entities the landing pages actually use", () => {
    expect(decodeEntities("$50 &middot; 10&times; ROI &rarr; live")).toBe(
      `$50 ${String.fromCharCode(0x00b7)} 10${String.fromCharCode(0xd7)} ROI ${String.fromCharCode(0x2192)} live`,
    );
  });

  it("leaves an unknown entity alone rather than eating it", () => {
    expect(decodeEntities("&notarealentity;")).toBe("&notarealentity;");
  });
});

describe("head extraction", () => {
  it("reads the title and description", () => {
    expect(extractTitle(PAGE)).toBe("Cost guide");
    expect(extractDescription(PAGE)).toBe("What a qualified lead costs.");
  });

  it("returns null when they are absent", () => {
    expect(extractTitle("<html><body>hi</body></html>")).toBeNull();
    expect(extractDescription("<html><body>hi</body></html>")).toBeNull();
  });
});
