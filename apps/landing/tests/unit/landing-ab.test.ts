import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  VARIANT_WEIGHTS,
  drawVariant,
  VARIANT_COOKIE,
  cookieValue,
  decideVariant,
  isBot,
  variantCookie,
  variantTrackingScript,
  withBeforeBodyEnd,
} from "../../src/lib/landing-ab";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const q = (s = "") => new URLSearchParams(s);

describe("the split rule", () => {
  it("draws a first-time human 50/50 between the homepage and the instinct page, and stores it", () => {
    expect(VARIANT_WEIGHTS).toEqual({ control: 0.5, instinct: 0.5, assistant: 0, concierge: 0 });
    expect(drawVariant(0)).toBe("control");
    expect(drawVariant(0.4999)).toBe("control");
    expect(drawVariant(0.5)).toBe("instinct");
    expect(drawVariant(0.9999)).toBe("instinct");
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) counts[drawVariant(i / 10000)] = (counts[drawVariant(i / 10000)] ?? 0) + 1;
    expect(counts).toEqual({ control: 5000, instinct: 5000 });
    expect(decideVariant({ cookieHeader: null, userAgent: CHROME, query: q(), random: 0.7, enabled: true })).toEqual({
      variant: "instinct", setCookie: true, inTest: true,
    });
  });

  it("keeps a returning visitor on a live arm their cookie names, and does not rewrite it", () => {
    const d = decideVariant({
      cookieHeader: `a=1; ${VARIANT_COOKIE}=instinct; b=2`, userAgent: CHROME, query: q(), random: 0.1, enabled: true,
    });
    expect(d).toEqual({ variant: "instinct", setCookie: false, inTest: true });
  });

  it("redraws a visitor whose cookie names a retired arm, or nothing", () => {
    for (const v of ["assistant", "concierge", "junk"]) {
      const d = decideVariant({ cookieHeader: `${VARIANT_COOKIE}=${v}`, userAgent: CHROME, query: q(), random: 0.3, enabled: true });
      expect(d, v).toEqual({ variant: "control", setCookie: true, inTest: true });
    }
  });

  it("lets ?variant= force either page and pins it in the cookie", () => {
    const d = decideVariant({
      cookieHeader: `${VARIANT_COOKIE}=assistant`, userAgent: CHROME, query: q("variant=control"), random: 0, enabled: true,
    });
    expect(d).toEqual({ variant: "control", setCookie: true, inTest: true });
  });

  it("serves crawlers, agents and empty user agents the homepage, outside the test", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1)",
      "ClaudeBot/1.0", "curl/8.4.0", "", null,
    ]) {
      expect(isBot(ua), String(ua)).toBe(true);
      expect(decideVariant({ cookieHeader: null, userAgent: ua, query: q("variant=assistant"), random: 0 }))
        .toEqual({ variant: "control", setCookie: false, inTest: false });
    }
    expect(isBot(CHROME)).toBe(false);
  });

  it("the kill switch serves the homepage to everyone and writes nothing", () => {
    expect(decideVariant({ cookieHeader: null, userAgent: CHROME, query: q(), random: 0, enabled: false }))
      .toEqual({ variant: "control", setCookie: false, inTest: false });
  });

  it("parses the cookie header and writes a registrable-domain cookie", () => {
    expect(cookieValue("x=1; lp_variant=control", "lp_variant")).toBe("control");
    expect(cookieValue(null, "lp_variant")).toBeNull();
    expect(variantCookie("assistant")).toBe(
      "lp_variant=assistant; Path=/; Max-Age=7776000; Domain=.distribute.you; SameSite=Lax; Secure",
    );
  });

  it("tags the visit in PostHog and injects before the last </body>", () => {
    const s = variantTrackingScript("assistant");
    expect(s).toContain('posthog.capture("landing_variant_viewed",{lp_variant:"assistant"})');
    expect(s).toContain('posthog.register({lp_variant:"assistant"})');
    expect(withBeforeBodyEnd("<body>a</body>", "X")).toBe("<body>aX</body>");
    expect(() => withBeforeBodyEnd("<p>", "X")).toThrow();
  });
});

describe("GET / with the test on", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline in tests"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => vi.unstubAllGlobals());

  async function get(opts: { ua?: string; cookie?: string; qs?: string; accept?: string } = {}) {
    const { GET } = await import("../../src/app/route");
    const headers: Record<string, string> = { "user-agent": opts.ua ?? CHROME, accept: opts.accept ?? "text/html" };
    if (opts.cookie) headers.cookie = opts.cookie;
    const res = await GET(new Request(`https://distribute.you/${opts.qs ?? ""}`, { headers }));
    return { res, html: await res.text() };
  }

  it("serves the instinct page to its arm, tagged, cookie pinned, out of shared caches", async () => {
    const { res, html } = await get({ qs: "?variant=instinct" });
    expect(html).toContain("Text distribute.you to get started");
    expect(html).toContain('lp_variant:"instinct"');
    expect(res.headers.get("set-cookie")).toContain("lp_variant=instinct");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("serves the homepage to the control arm, tagged", async () => {
    const { html } = await get({ cookie: "lp_variant=control" });
    expect(html).toContain("Get <span class=\"accent\">revenue in 24h</span>");
    expect(html).toContain('lp_variant:"control"');
  });

  it("gives a crawler the homepage, untagged, with no cookie", async () => {
    const { res, html } = await get({ ua: "Googlebot/2.1", qs: "?variant=instinct" });
    expect(html).not.toContain("Text distribute.you to get started");
    expect(html).not.toContain("landing_variant_viewed");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers an agent asking for markdown with the homepage", async () => {
    const { res, html } = await get({ accept: "text/markdown", qs: "?variant=instinct" });
    expect(res.headers.get("content-type")).toContain("markdown");
    expect(html).not.toContain("Text distribute.you to get started");
  });
});
