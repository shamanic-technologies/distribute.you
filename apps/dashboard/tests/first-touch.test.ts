import { describe, it, expect } from "vitest";
import {
  FIRST_TOUCH_CAPTURE_SCRIPT,
  FIRST_TOUCH_COOKIE,
  firstTouchForHandover,
  firstTouchFromCookieHeader,
} from "../src/lib/first-touch";

/**
 * Runs the exact string the landing and the dashboard render, against stubbed
 * globals. `new Function` binds the free variables it reads, so this is the
 * shipped script, not a re-implementation of it.
 */
function capture(opts: {
  url: string;
  referrer?: string;
  cookie?: string;
}): { written: string | null; cookie: string } {
  const u = new URL(opts.url);
  let jar = opts.cookie ?? "";
  let written: string | null = null;
  const document = {
    referrer: opts.referrer ?? "",
    get cookie() {
      return jar;
    },
    set cookie(v: string) {
      written = v;
      const pair = v.split(";")[0];
      jar = jar ? `${jar}; ${pair}` : pair;
    },
  };
  const location = {
    search: u.search,
    pathname: u.pathname,
    hostname: u.hostname,
    protocol: u.protocol,
  };
  new Function("document", "location", "URLSearchParams", "URL", FIRST_TOUCH_CAPTURE_SCRIPT)(
    document,
    location,
    URLSearchParams,
    URL,
  );
  return { written, cookie: jar };
}

function touchOf(opts: Parameters<typeof capture>[0]) {
  const { cookie } = capture(opts);
  return firstTouchFromCookieHeader(cookie);
}

describe("first-touch capture script", () => {
  it("records a newsletter click with its utm tags", () => {
    const t = touchOf({
      url: "https://distribute.you/?utm_source=newsletter&utm_medium=email&utm_campaign=flash-vs-pro",
    });
    expect(t).toMatchObject({
      channel: "newsletter",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "flash-vs-pro",
      landingPath: "/",
    });
  });

  it("records a cold-email click", () => {
    const t = touchOf({ url: "https://distribute.you/?utm_source=cold-email&utm_medium=email" });
    expect(t?.channel).toBe("cold_email");
  });

  it("records a visit with no signal as DIRECT, explicitly", () => {
    const t = touchOf({ url: "https://distribute.you/" });
    expect(t?.channel).toBe("direct");
    expect(t?.referrer).toBeUndefined();
  });

  it("classifies referrers by host, AI assistants before search", () => {
    expect(touchOf({ url: "https://distribute.you/", referrer: "https://chatgpt.com/c/abc" })?.channel).toBe("ai_assistant");
    expect(touchOf({ url: "https://distribute.you/", referrer: "https://gemini.google.com/app" })?.channel).toBe("ai_assistant");
    expect(touchOf({ url: "https://distribute.you/", referrer: "https://www.google.com/" })?.channel).toBe("organic_search");
    expect(touchOf({ url: "https://distribute.you/", referrer: "https://t.co/xyz" })?.channel).toBe("social");
    expect(touchOf({ url: "https://distribute.you/", referrer: "https://www.linkedin.com/feed" })?.channel).toBe("social");
    expect(touchOf({ url: "https://distribute.you/", referrer: "https://someblog.io/post" })?.channel).toBe("referral");
  });

  it("keeps only the referrer HOST, never its path", () => {
    const t = touchOf({ url: "https://distribute.you/", referrer: "https://www.google.com/search?q=secret" });
    expect(t?.referrer).toBe("www.google.com");
  });

  it("treats its own domain as no referrer", () => {
    const t = touchOf({ url: "https://dashboard.distribute.you/sign-up", referrer: "https://distribute.you/pricing" });
    expect(t?.channel).toBe("direct");
  });

  it("reads ChatGPT's own utm_source as an AI assistant", () => {
    expect(touchOf({ url: "https://distribute.you/?utm_source=chatgpt.com" })?.channel).toBe("ai_assistant");
  });

  it("records a Google Ads click and a partner referral", () => {
    expect(touchOf({ url: "https://distribute.you/?gclid=abc" })).toMatchObject({ channel: "paid_search", gclid: "abc" });
    expect(touchOf({ url: "https://distribute.you/", cookie: "_gcl_aw=GCL.1700000000.Cj0KCQ_x" })).toMatchObject({
      channel: "paid_search",
      gclid: "Cj0KCQ_x",
    });
    expect(touchOf({ url: "https://distribute.you/?via=jane" })).toMatchObject({ channel: "partner", referralCode: "jane" });
  });

  it("records the homepage A/B arm the visitor was shown", () => {
    const t = touchOf({ url: "https://distribute.you/", cookie: "lp_variant=concierge" });
    expect(t?.homepageVariant).toBe("concierge");
  });

  it("NEVER overwrites a first touch that is already recorded", () => {
    const first = capture({ url: "https://distribute.you/?utm_source=newsletter" });
    const second = capture({ url: "https://distribute.you/?utm_source=google&utm_medium=cpc", cookie: first.cookie });
    expect(second.written).toBeNull();
    expect(firstTouchFromCookieHeader(second.cookie)?.channel).toBe("newsletter");
  });

  it("writes on the registrable domain so the dashboard and its server read it", () => {
    const { written } = capture({ url: "https://distribute.you/" });
    expect(written).toContain(`${FIRST_TOUCH_COOKIE}=`);
    expect(written).toContain("Domain=.distribute.you");
    expect(written).toContain("Secure");
    expect(written).toContain("Max-Age=31536000");
  });

  it("never throws on a broken environment", () => {
    expect(() =>
      new Function("document", "location", FIRST_TOUCH_CAPTURE_SCRIPT)(null, null),
    ).not.toThrow();
  });
});

describe("hand-over", () => {
  it("sends UNKNOWN, not nothing, when no cookie was recorded", () => {
    const now = new Date("2026-09-26T10:00:00Z");
    expect(firstTouchForHandover(null, now)).toEqual({ channel: "unknown", firstSeenAt: now.toISOString() });
    expect(firstTouchForHandover("other=1", now).channel).toBe("unknown");
  });

  it("refuses a hand-edited cookie rather than trusting it", () => {
    expect(firstTouchFromCookieHeader(`${FIRST_TOUCH_COOKIE}=%7Bnot-json`)).toBeNull();
    expect(firstTouchFromCookieHeader(`${FIRST_TOUCH_COOKIE}=${encodeURIComponent('{"ch":"<b>"}')}`)).toBeNull();
  });

  it("bounds every field", () => {
    const long = "x".repeat(5000);
    const cookie = `${FIRST_TOUCH_COOKIE}=${encodeURIComponent(
      JSON.stringify({ v: 1, ch: "other", at: "2026-09-26T10:00:00Z", src: long, cmp: long }),
    )}`;
    const t = firstTouchFromCookieHeader(cookie)!;
    expect(t.utmSource!.length).toBeLessThanOrEqual(200);
    expect(t.utmCampaign!.length).toBeLessThanOrEqual(200);
  });
});
