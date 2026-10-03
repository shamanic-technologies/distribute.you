import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countryLabel, formatDuration, sourceLine, stageOf, visitRecap, type VisitEvent } from "../src/lib/visit-recap";
import { ENDED_VISITS_SQL, rowToEvent } from "../src/lib/visit-recap-job";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const T0 = Date.parse("2026-10-03T10:00:00Z");
function ev(offsetS: number, partial: Partial<VisitEvent>): VisitEvent {
  return {
    timestamp: new Date(T0 + offsetS * 1000).toISOString(),
    event: "$pageview",
    host: "dashboard.distribute.you",
    pathname: "/get-started",
    currentUrl: null,
    elText: null,
    title: null,
    country: "FR",
    referringDomain: null,
    utmSource: null,
    utmMedium: null,
    utmTerm: null,
    gclid: null,
    website: null,
    ...partial,
  };
}

const landing = { host: "distribute.you", pathname: "/" };
const click = (s: number, text: string, where: Partial<VisitEvent> = {}) => ev(s, { event: "$autocapture", elText: text, ...where });

describe("visit recap (owner 2026-10-03: one readable Telegram per human visit)", () => {
  it("files each event under landing, onboarding, signup, payment or dashboard", () => {
    expect(stageOf(ev(0, landing))).toBe("Landing");
    expect(stageOf(ev(0, {}))).toBe("Onboarding");
    expect(stageOf(ev(0, { pathname: "/onboarding" }))).toBe("Onboarding");
    expect(stageOf(ev(0, { pathname: "/sign-in" }))).toBe("Signup");
    expect(stageOf(ev(0, { event: "get_started_signup_email_started" }))).toBe("Signup");
    expect(stageOf(ev(0, { event: "get_started_card_saved" }))).toBe("Payment");
    expect(stageOf(ev(0, { pathname: "/onboarding", currentUrl: "https://dashboard.distribute.you/onboarding?launch_checkout=success" }))).toBe("Payment");
    expect(stageOf(ev(0, { pathname: "/v2/orgs/x" }))).toBe("Dashboard");
  });

  it("prints a flag and a country name, never a bare code", () => {
    expect(countryLabel("FR")).toBe("🇫🇷 France");
    expect(countryLabel(null)).toBe("🌍 Unknown country");
    expect(countryLabel("XX")).toBe("🌍 Unknown country");
  });

  it("prints durations in words a glance reads", () => {
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(200_000)).toBe("3 min 20");
    expect(formatDuration(120_000)).toBe("2 min");
    expect(formatDuration(3_900_000)).toBe("1 h 05");
  });

  it("says where the visit came from, with the ad keyword when Google Ads passes one", () => {
    expect(sourceLine(ev(0, { ...landing, referringDomain: "www.google.com" }))).toBe("Came from Google search, landed on the homepage");
    expect(
      sourceLine(ev(0, { host: "distribute.you", pathname: "/alternatives/explee", title: "Explee alternative | distribute.you", referringDomain: "www.google.com" })),
    ).toBe('Came from Google search, landed on "Explee alternative"');
    expect(sourceLine(ev(0, { ...landing, gclid: "abc", utmTerm: "best explee alternative" }))).toBe(
      'Came from Google Ads ("best explee alternative"), landed on the homepage',
    );
    expect(sourceLine(ev(0, { ...landing, referringDomain: "$direct" }))).toBe("Came direct, landed on the homepage");
    expect(sourceLine(ev(0, { referringDomain: "chatgpt.com" }))).toBe("Came from an AI assistant (chatgpt.com), landed on onboarding");
    expect(sourceLine(ev(0, { pathname: "/v2/orgs/x" }))).toBe("Came direct, landed on the dashboard");
    expect(sourceLine(ev(0, { ...landing, pathname: "/alternatives", title: "A".repeat(80) }))).toBe(`Came direct, landed on "${"A".repeat(59)}…"`);
  });

  it("builds the whole message: header, source, stages with time and clicks, what was not reached", () => {
    const text = visitRecap([
      ev(0, { ...landing, referringDomain: "www.google.com" }),
      click(30, "Pricing", landing),
      click(50, "Start free", landing),
      ev(70, {}),
      click(80, "Continue"),
      click(90, "Continue"),
      click(95, "hello@acme.com"),
      ev(100, { event: "get_started_website_submitted", website: "acme.com" }),
      ev(130, { event: "get_started_signup_email_started" }),
      ev(170, { event: "get_started_signup_verified" }),
      ev(230, { event: "get_started_card_saved" }),
    ]);
    expect(text).toBe(
      [
        "🇫🇷 France · 3 min 50 · <b>Paid ✅</b>",
        "Came from Google search, landed on the homepage",
        "Typed acme.com",
        "",
        "<b>Landing</b> · 1 min 10",
        '"Pricing", "Start free"',
        "",
        "<b>Onboarding</b> · 1 min",
        '"Continue" ×2',
        "",
        "<b>Signup ✓</b> · 40 s",
        "",
        "<b>Payment</b> · 1 min",
        "",
        "Not reached: dashboard",
      ].join("\n"),
    );
  });

  it("names the stage a visitor left at, and puts Stripe time under Payment", () => {
    const left = visitRecap([ev(0, landing), ev(20, {}), click(40, "Start")]);
    expect(left.split("\n")[0]).toBe("🇫🇷 France · 40 s · <b>Left at onboarding ❌</b>");
    expect(left).toContain("Not reached: signup, payment, dashboard");

    const cancelled = visitRecap([
      ev(0, { pathname: "/onboarding" }),
      ev(60, { pathname: "/onboarding", currentUrl: "https://dashboard.distribute.you/onboarding?launch_checkout=cancelled" }),
    ]);
    expect(cancelled).toContain("<b>Payment</b> · 1 min");
    expect(cancelled).toContain("Left at payment ❌");
  });

  it("escapes HTML in what the visitor clicked (Telegram parse_mode HTML)", () => {
    expect(visitRecap([ev(0, {}), click(5, "<b>x</b> & y")])).toContain('"&lt;b&gt;x&lt;/b&gt; &amp; y"');
  });

  it("keeps only humans who reached onboarding, over visits that ended 30 to 40 minutes ago", () => {
    expect(ENDED_VISITS_SQL).toContain("properties.$pathname in ('/get-started', '/onboarding')");
    expect(ENDED_VISITS_SQL).toContain("now() - interval 40 minute and now() - interval 30 minute");
    expect(ENDED_VISITS_SQL).toContain("kevin.lourd@gmail.com");
    expect(ENDED_VISITS_SQL).toContain("properties.$screen_width = properties.$viewport_width");
    expect(ENDED_VISITS_SQL).toContain("properties.$screen_width = 1680");
  });

  it("maps a PostHog row onto a visit event, empty strings as absent", () => {
    const { sessionId, event } = rowToEvent(["s1", "2026-10-03T10:00:00Z", "$pageview", "distribute.you", "/", "", null, null, "FR", "$direct", null, null, null, null, "acme.com"]);
    expect(sessionId).toBe("s1");
    expect(event.currentUrl).toBeNull();
    expect(event.website).toBe("acme.com");
  });

  it("is started from instrumentation, in production only, and the old entry ping is gone", () => {
    const instr = read("src/instrumentation.ts");
    expect(instr).toContain('import("@/lib/visit-recap-job")');
    expect(instr).toContain('process.env.NODE_ENV === "production"');
    expect(read("src/app/(authed)/get-started/page.tsx")).not.toContain("EntryPing");
    expect(read("src/app/(authed)/onboarding/page.tsx")).not.toContain("EntryPing");
  });

  it("v2 onboarding sends the typed website with its submit event", () => {
    expect(read("src/components/v2/get-started/get-started.tsx")).toContain('posthog.capture("get_started_website_submitted", { website:');
  });
});
