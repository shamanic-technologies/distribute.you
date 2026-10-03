import { describe, it, expect } from "vitest";
import { htmlToText, articleText } from "../../src/lib/blog/plain-text";

describe("blog article as plain text (social-service reader)", () => {
  it("keeps the words, drops tags, scripts and JSON-LD, breaks blocks into lines", () => {
    const html = `<h2>Follow-ups</h2><p>Positive replies keep coming through <strong>2 follow-ups</strong> &amp; more.</p>
<script type="application/ld+json">{"@type":"Dataset"}</script><svg><text>chart</text></svg>
<div style="overflow-x:auto"><table><tr><th>Step</th><th>Replies</th></tr><tr><td>First</td><td>19</td></tr></table></div><ul><li>One</li><li>Two</li></ul>`;
    const t = htmlToText(html);
    expect(t).toContain("Follow-ups\nPositive replies keep coming through 2 follow-ups & more.");
    expect(t).toContain("First | 19 |");
    expect(t).toContain("- One\n- Two");
    expect(t).not.toMatch(/Dataset|chart|<|>/);
  });

  it("prefers the markdown body, falls back to the HTML, empty when neither", () => {
    expect(articleText({ contentMarkdown: "# Hi", contentHtml: "<p>x</p>" })).toBe("# Hi");
    expect(articleText({ contentMarkdown: null, contentHtml: "<p>x</p>" })).toBe("x");
    expect(articleText({ contentMarkdown: " ", contentHtml: null })).toBe("");
  });

  it("decodes numeric and named entities", () => {
    expect(htmlToText("<p>It&#39;s &ldquo;ok&rdquo; &#8212; fine&nbsp;now</p>")).toBe("It's “ok” — fine now");
  });
});
