import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSISTANT_PATH, homepageBlocks, renderAssistantPage } from "../../src/lib/pages/assistant";
import { SIGN_UP } from "../../src/lib/v2-shell";

const root = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** What a reader sees: tags, styles and scripts removed. */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ");
}

/** A homepage carrying every marker and nothing else, so the page's OWN copy can be
 *  asserted without the borrowed sections (the FAQ legitimately says "not guaranteed"). */
const STUB_HOME = [
  '<section class="hero"><div class="wrap hero-inner"><div class="showcase">SHOWCASE</div>',
  "  </div>\n</section>",
  "<!-- Proof -->PROOF<!-- How it works -->HOW<!-- Pipeline -->REST<!-- CTA -->",
].join("\n");

describe("/lp/assistant: the value-proposition candidate homepage", () => {
  const html = renderAssistantPage();
  const own = renderAssistantPage(STUB_HOME);

  it("is served by its own route through the shared pipeline", () => {
    const route = read("src/app/lp/assistant/route.ts");
    expect(route).toContain("renderedResponse(renderAssistantPage(), request)");
    expect(ASSISTANT_PATH).toBe("/lp/assistant");
  });

  it("is a candidate under review: noindex, no canonical, not in the sitemap", () => {
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('rel="canonical"');
    expect(read("src/app/sitemap.ts")).not.toContain("/lp/");
  });

  it("converts exactly like the homepage: a website field posting url to the picker", () => {
    expect(html).toContain(`<form class="launch" action="${SIGN_UP}" method="get" id="asst-hero-form">`);
    expect(html).toMatch(/<input name="url" type="text"/);
    expect(read("public/landing/index-v2.html")).toContain(`action="${SIGN_UP}"`);
  });

  it("leads with the assistant proposition and the three channels the buyer already uses", () => {
    const text = visibleText(html);
    expect(text).toContain("AI sales assistant");
    expect(text).toContain("It works where you already are.");
    for (const channel of ["Your inbox", "Your phone", "Your calendar"]) {
      expect(text).toContain(channel);
    }
  });

  it("states the live hot-lead proof off the shared token, never a typed figure", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
  });

  it("wears the shared chrome and leaves the shared stylesheet alone", () => {
    expect(html).toContain('class="nav"');
    expect(html).toContain("<footer>");
    expect(read("public/landing/v2/styles.css")).not.toContain("asst-");
  });

  it("its own copy carries no em-dash and no promise of guaranteed meetings", () => {
    const text = visibleText(own);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/guarantee/i);
    expect(text).not.toMatch(/at cost|no markup|pass-through/i);
  });

  it("borrows every homepage section but How it works, in order, from the live file", () => {
    const home = read("public/landing/index-v2.html");
    const order = [
      'class="showcase"',
      "It works where you already are.",
      'id="proof"',
      'id="quotes"',
      "Three steps, and only the first one is yours.",
      'id="pipeline"',
      'id="features"',
      'class="framed dark"',
      'id="fit"',
      'id="pricing"',
      'id="faq"',
    ];
    const at = order.map((m) => html.indexOf(m));
    at.forEach((i, n) => expect(i, order[n]).toBeGreaterThan(-1));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).not.toContain('id="steps-nav"');
    const blocks = homepageBlocks(home);
    expect(html).toContain(blocks.proofAndQuotes);
    expect(html).toContain(blocks.rest);
  });

  it("throws rather than silently dropping a section when a homepage marker moves", () => {
    expect(() => homepageBlocks(STUB_HOME.replace("<!-- Pipeline -->", ""))).toThrow(/marker/);
  });
});
