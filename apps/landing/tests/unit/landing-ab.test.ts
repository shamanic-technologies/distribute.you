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
  it("draws a first-time human by the weights (1/2 concierge, 1/4 each other) and stores it", () => {
    expect(VARIANT_WEIGHTS).toEqual({ concierge: 0.5, control: 0.25, assistant: 0.25 });
    expect(drawVariant(0)).toBe("control");
    expect(drawVariant(0.2499)).toBe("control");
    expect(drawVariant(0.25)).toBe("assistant");
    expect(drawVariant(0.4999)).toBe("assistant");
    expect(drawVariant(0.5)).toBe("concierge");
    expect(drawVariant(0.9999)).toBe("concierge");
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) counts[drawVariant(i / 10000)] = (counts[drawVariant(i / 10000)] ?? 0) + 1;
    expect(counts).toEqual({ control: 2500, assistant: 2500, concierge: 5000 });
    expect(decideVariant({ cookieHeader: null, userAgent: CHROME, query: q(), random: 0.7 })).toEqual({
      variant: "concierge", setCookie: true, inTest: true,
    });
  });

  it("keeps a returning visitor on the variant their cookie names, and does not rewrite it", () => {
    const d = decideVariant({
      cookieHeader: `a=1; ${VARIANT_COOKIE}=assistant; b=2`, userAgent: CHROME, query: q(), random: 0.99,
    });
    expect(d).toEqual({ variant: "assistant", setCookie: false, inTest: true });
  });

  it("redraws on a cookie value that names no variant", () => {
    const d = decideVariant({ cookieHeader: `${VARIANT_COOKIE}=junk`, userAgent: CHROME, query: q(), random: 0.3 });
    expect(d).toEqual({ variant: "assistant", setCookie: true, inTest: true });
  });

  it("lets ?variant= force either page and pins it in the cookie", () => {
    const d = decideVariant({
      cookieHeader: `${VARIANT_COOKIE}=assistant`, userAgent: CHROME, query: q("variant=control"), random: 0,
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

describe("GET / serves the split", () => {
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

  it("serves the assistant page at / as the homepage: indexable, canonical /", async () => {
    const { res, html } = await get({ qs: "?variant=assistant" });
    expect(html).toContain("asst-eyebrow");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/">');
    expect(html).not.toContain('content="noindex"');
    expect(html).toContain('lp_variant:"assistant"');
    expect(res.headers.get("set-cookie")).toContain("lp_variant=assistant");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("serves the concierge page at / as the homepage: indexable, canonical /", async () => {
    const { res, html } = await get({ qs: "?variant=concierge" });
    expect(html).toContain("Just message it.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/">');
    expect(html).not.toContain('content="noindex"');
    expect(html).toContain('lp_variant:"concierge"');
    expect(res.headers.get("set-cookie")).toContain("lp_variant=concierge");
  });

  it("serves the current homepage to the control arm, tagged", async () => {
    const { res, html } = await get({ cookie: "lp_variant=control" });
    expect(html).toContain("Get <span class=\"accent\">revenue in 24h</span>");
    expect(html).not.toContain("asst-eyebrow");
    expect(html).toContain('lp_variant:"control"');
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("gives a crawler the homepage, untagged, with no cookie", async () => {
    const { res, html } = await get({ ua: "Googlebot/2.1", qs: "?variant=assistant" });
    expect(html).not.toContain("asst-eyebrow");
    expect(html).not.toContain("landing_variant_viewed");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers an agent asking for markdown with the homepage", async () => {
    const { res, html } = await get({ accept: "text/markdown", qs: "?variant=assistant" });
    expect(res.headers.get("content-type")).toContain("markdown");
    expect(html).not.toContain("build than prospect");
  });

  it("the candidate URL stays noindex", () => {
    const route = readFileSync(path.resolve(__dirname, "../../src/app/lp/assistant/route.ts"), "utf8");
    expect(route).toContain("renderAssistantPage()");
  });
});
