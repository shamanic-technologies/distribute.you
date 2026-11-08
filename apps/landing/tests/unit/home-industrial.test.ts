import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// HOME-INDUSTRIAL-1108 (owner 2026-11-08): the homepage hero is "Revenue Automation /
// Industrial-Grade", for the solo founder of a B2B service making $100k+/year who wants
// to scale. Tested 50/50 for an hour, then "switche direct à 100%": it lives in
// `index-v2.html` itself, so crawlers and every visitor see it.

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const html = readFileSync(path.join(__dirname, "../../public/landing/index-v2.html"), "utf8");
const SUBTITLE =
  "Meet your distribution teammate. We bring you meetings, signups and sales, every result measured and auditable.";
const visible = (s: string) => s.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");

describe("the Industrial-Grade hero", () => {
  it("states the owner's title, subtitle and six words, no cost row", () => {
    expect(html).toContain('<h1>Revenue Automation<br><span class="accent ig">Industrial-Grade');
    expect(html).not.toContain('<span class="accent">Done For You</span>');
    expect(html).toContain(`<span class="sub">${SUBTITLE}</span>`);
    expect(html).toContain(
      '<ul class="ig-pills"><li>Easy</li><li>Measurable</li><li>Auditable</li><li>Solid</li><li>Fast</li><li>State of the art</li></ul>',
    );
    expect(html.indexOf('class="ig-pills"')).toBeGreaterThan(html.indexOf('class="hero-links"'));
    expect(html).not.toContain("__HOT_LEAD_ROW__");
  });

  it("sparkles are decoration only and stop under reduced motion", () => {
    expect((html.match(/class="ig-spark" aria-hidden="true"/g) ?? []).length).toBe(7);
    expect(html).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.ig\{animation:none[^}]*\}\.ig-spark\{display:none\}/);
    // main.js wraps each title word in `.w`: the text clip must ride the word, keeping its entrance.
    expect(html).toMatch(/\.hero h1 \.ig>\.w\{[^}]*background-clip:text[^}]*animation:word-in [^}]*ig-shine/);
    expect(html).not.toContain("transition:all");
  });

  it("copy obeys the homepage rules", () => {
    const hero = visible(html.slice(html.indexOf("<h1>"), html.indexOf("</ul>", html.indexOf("ig-pills"))));
    expect(hero).not.toMatch(/[—–]/);
    expect(hero).not.toMatch(/\bcost\b/i);
  });
});

describe("GET / serves it to everyone", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline in tests"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => vi.unstubAllGlobals());

  it("humans and crawlers alike", async () => {
    const { GET } = await import("../../src/app/route");
    for (const ua of [CHROME, "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"]) {
      const res = await GET(new Request("https://distribute.you/", { headers: { "user-agent": ua, accept: "text/html" } }));
      const page = await res.text();
      expect(page, ua).toContain("Industrial-Grade");
      expect(page, ua).toContain(SUBTITLE);
      expect(page, ua).not.toContain("expected cost per booked meeting");
    }
  });
});
