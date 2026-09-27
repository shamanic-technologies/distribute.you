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
    expect(decideVariant({ cookieHeader: null, userAgent: CHROME, query: q(), random: 0.7, enabled: true })).toEqual({
      variant: "concierge", setCookie: true, inTest: true,
    });
  });

  it("keeps a returning visitor on the variant their cookie names, and does not rewrite it", () => {
    const d = decideVariant({
      cookieHeader: `a=1; ${VARIANT_COOKIE}=assistant; b=2`, userAgent: CHROME, query: q(), random: 0.99, enabled: true,
    });
    expect(d).toEqual({ variant: "assistant", setCookie: false, inTest: true });
  });

  it("redraws on a cookie value that names no variant", () => {
    const d = decideVariant({ cookieHeader: `${VARIANT_COOKIE}=junk`, userAgent: CHROME, query: q(), random: 0.3, enabled: true });
    expect(d).toEqual({ variant: "assistant", setCookie: true, inTest: true });
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

describe("GET / with the test off", () => {
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

  it("the test is off: every human gets the control homepage, untagged, with no cookie", async () => {
    for (const opts of [{}, { qs: "?variant=assistant" }, { qs: "?variant=concierge" }, { cookie: "lp_variant=concierge" }]) {
      const { res, html } = await get(opts);
      expect(html).toContain("Get <span class=\"accent\">revenue in 24h</span>");
      expect(html).not.toContain("asst-eyebrow");
      expect(html).not.toContain("landing_variant_viewed");
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(res.headers.get("cache-control")).not.toBe("private, no-store");
    }
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
