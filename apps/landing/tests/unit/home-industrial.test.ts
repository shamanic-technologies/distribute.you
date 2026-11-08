import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  INDUSTRIAL_PILLS,
  INDUSTRIAL_STYLE,
  INDUSTRIAL_SUBTITLE,
  withIndustrialHero,
} from "../../src/lib/pages/home-industrial";

// HOME-INDUSTRIAL-1108 (owner 2026-11-08): the `industrial` A/B arm is the homepage with
// another hero. These pin what that arm shows and that it fails loud if the homepage
// moves an anchor (instead of serving the control hero under the `industrial` tag).

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const HOMEPAGE_SRC = readFileSync(path.join(__dirname, "../../public/landing/index-v2.html"), "utf8");
const visible = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");

describe("withIndustrialHero", () => {
  const out = withIndustrialHero(HOMEPAGE_SRC);

  it("swaps the title, the subtitle and drops the cost row, nothing else", () => {
    expect(out).toContain('<h1>Revenue Automation<br><span class="accent ig">Industrial-Grade');
    expect(out).not.toContain('<span class="accent">Done For You</span>');
    expect(out).toContain(`<span class="sub">${INDUSTRIAL_SUBTITLE}</span>`);
    expect(out).not.toContain("__HOT_LEAD_ROW__");
    // The rest of the page is the homepage, byte for byte.
    const tail = HOMEPAGE_SRC.slice(HOMEPAGE_SRC.indexOf("</form>"));
    expect(out).toContain(tail.slice(tail.indexOf('<div class="agent-stage"')));
  });

  it("lists the owner's six words under the form", () => {
    expect(INDUSTRIAL_PILLS).toEqual(["Easy", "Measurable", "Auditable", "Solid", "Fast", "State of the art"]);
    expect(out).toContain(`<ul class="ig-pills">${INDUSTRIAL_PILLS.map((p) => `<li>${p}</li>`).join("")}</ul>`);
    expect(out.indexOf('class="ig-pills"')).toBeGreaterThan(out.indexOf('class="hero-links"'));
  });

  it("sparkles are decoration only and stop under reduced motion", () => {
    expect((out.match(/class="ig-spark" aria-hidden="true"/g) ?? []).length).toBe(7);
    expect(INDUSTRIAL_STYLE).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.ig\{animation:none[^}]*\}\.ig-spark\{display:none\}/);
    expect(INDUSTRIAL_STYLE).not.toContain("transition:all");
    // main.js wraps each title word in `.w`: the clip must ride the word, keeping its entrance.
    expect(INDUSTRIAL_STYLE).toMatch(/\.hero h1 \.ig>\.w\{[^}]*background-clip:text[^}]*animation:word-in [^}]*ig-shine/);
    expect(INDUSTRIAL_STYLE).not.toMatch(/ease-in[^-]/);
  });

  it("copy obeys the homepage rules", () => {
    const text = visible(out.slice(out.indexOf("<h1>"), out.indexOf("</ul>", out.indexOf("ig-pills"))));
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/\bcost\b/i);
  });

  it("fails loud when the homepage moves an anchor", () => {
    expect(() => withIndustrialHero(HOMEPAGE_SRC.replace("Done For You</span>", "Done For You!</span>"))).toThrow(/control H1/);
    expect(() => withIndustrialHero(HOMEPAGE_SRC.replace("__HOT_LEAD_ROW__", ""))).toThrow(/hot-lead row/);
  });
});

describe("GET / on the industrial arm", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline in tests"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => vi.unstubAllGlobals());

  async function get(qs: string, ua = CHROME) {
    const { GET } = await import("../../src/app/route");
    const res = await GET(new Request(`https://distribute.you/${qs}`, { headers: { "user-agent": ua, accept: "text/html" } }));
    return { res, html: await res.text() };
  }

  it("serves the Industrial-Grade hero, tagged, cookie pinned, with the site chrome", async () => {
    const { res, html } = await get("?variant=industrial");
    expect(html).toContain("Industrial-Grade");
    expect(html).toContain(INDUSTRIAL_SUBTITLE);
    expect(html).not.toContain("expected cost per booked meeting");
    expect(html).not.toContain("<!--site-nav-->");
    expect(html).toContain('lp_variant:"industrial"');
    expect(res.headers.get("set-cookie")).toContain("lp_variant=industrial");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("leaves the postpaid arm and crawlers on the homepage as it is", async () => {
    for (const [qs, ua] of [["?variant=postpaid", CHROME], ["?variant=industrial", "Googlebot/2.1"]] as const) {
      const { html } = await get(qs, ua);
      expect(html, qs + ua).toContain('Revenue Automation<br><span class="accent">Done For You</span>');
      expect(html, qs + ua).not.toContain("Industrial-Grade");
    }
  });
});
