import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { companyDomain, countryLabel, firmographicLines, formatAgo, formatDuration, guessRole, sourceLine, stageOf, visitPerson, visitRecap, type VisitEvent } from "../src/lib/visit-recap";
import { companyLines, ENDED_VISITS_SQL, rowToEvent, rowToVisit } from "../src/lib/visit-recap-job";

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
    email: null,
    personName: null,
    topupUsd: null,
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

  it("a visitor who opened the card form and left reached payment, unpaid (owner 2026-10-06, WHITE)", () => {
    const text = visitRecap([
      ev(0, {}),
      click(20, "Continue with Google"),
      ev(60, { event: "get_started_signup_verified" }),
      ev(90, { event: "get_started_topup_opened", topupUsd: 100 }),
      ev(150, {}),
    ]);
    expect(text.split("\n")[0]).toBe("🇫🇷 France · 2 min 30 · <b>Opened the $100 checkout, did not pay ❌</b>");
    expect(text).toContain("<b>Payment ✗ · $100 checkout opened</b>");
    expect(text).toContain("Not reached: landing, dashboard");
    expect(text).not.toContain("Left at signup");

    const paid = visitRecap([
      ev(0, {}),
      ev(30, { event: "get_started_topup_opened", topupUsd: 250 }),
      ev(90, { event: "get_started_card_saved" }),
    ]);
    expect(paid.split("\n")[0]).toContain("<b>Paid $250 ✅</b>");
    expect(paid).toContain("<b>Payment ✓ · $250 checkout opened</b>");
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
    const { sessionId, event } = rowToEvent(["s1", "2026-10-03T10:00:00Z", "$pageview", "distribute.you", "/", "", null, null, "FR", "$direct", null, null, null, null, "acme.com", "jane@acme.com", "Jane Doe", 100]);
    expect(sessionId).toBe("s1");
    expect(event.topupUsd).toBe(100);
    expect(event.currentUrl).toBeNull();
    expect(event.website).toBe("acme.com");
    expect(event.email).toBe("jane@acme.com");
    expect(event.personName).toBe("Jane Doe");
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

describe("visit recap firmographics (owner 2026-10-04: who is the company behind the visit)", () => {
  const firmo = {
    hqCountry: "US",
    industry: "Marketing & advertising",
    employeeRange: "51-200",
    revenueRange: "$10M-$50M",
    category: "B2B SaaS",
    role: "Head of Growth",
  };

  it("reads the company domain from the typed website, else a signed-up email", () => {
    expect(companyDomain("https://www.Acme.com/pricing", null)).toBe("acme.com");
    expect(companyDomain("acme.io", "jane@other.com")).toBe("acme.io");
    expect(companyDomain(null, "Jane@Acme.com")).toBe("acme.com");
    expect(companyDomain("not a site", null)).toBeNull();
    expect(companyDomain(null, null)).toBeNull();
  });

  it("finds the person and the domain across the visit's events", () => {
    const person = visitPerson([ev(0, {}), ev(5, { website: "acme.com" }), ev(9, { email: "jane@acme.com", personName: "Jane Doe" })]);
    expect(person).toEqual({ domain: "acme.com", email: "jane@acme.com", firstName: "Jane", lastName: "Doe" });
    expect(visitPerson([ev(0, {})])).toBeNull();
  });

  it("renders HQ, category, industry, size, revenue and role on two lines", () => {
    expect(firmographicLines(firmo)).toEqual([
      "HQ 🇺🇸 United States · B2B SaaS · Marketing &amp; advertising",
      "51-200 employees · $10M-$50M revenue · Head of Growth",
    ]);
  });

  it("says unknown instead of guessing, and drops nothing silently", () => {
    expect(firmographicLines({ hqCountry: null, industry: null, employeeRange: null, revenueRange: null, category: null, role: null })).toEqual([
      "HQ unknown · Category unknown · Industry unknown",
      "Size unknown · Revenue unknown · Role unknown",
    ]);
  });

  it("puts the company block under the typed website", () => {
    const text = visitRecap([ev(0, { website: "acme.com" })], firmographicLines(firmo));
    expect(text.indexOf("Typed acme.com")).toBeLessThan(text.indexOf("HQ 🇺🇸 United States"));
    expect(text.indexOf("HQ 🇺🇸 United States")).toBeLessThan(text.indexOf("<b>Onboarding</b>"));
    expect(visitRecap([ev(0, { website: "acme.com" })])).not.toContain("HQ ");
  });

  const served = (over: Record<string, unknown> = {}) => ({
    domain: "acme.com",
    company: {
      name: "Acme",
      domain: "acme.com",
      countryCode: "US",
      countryName: "United States",
      industry: "Marketing & advertising",
      revenueRange: { label: "$10M-$50M", min: 10_000_000, max: 50_000_000 },
      employeeRange: { label: "51-200", min: 51, max: 200 },
      category: "B2B SaaS",
      categoryConfidence: 0.9,
      apolloOrganizationId: "o1",
    },
    noCompanyReason: null,
    person: { title: "Head of Growth", seniority: "head" },
    personMatched: true,
    cached: { company: false, person: false },
    ...over,
  });

  it("maps apollo-service's answer onto the two company lines", () => {
    expect(companyLines(served())).toEqual(firmographicLines(firmo));
  });

  it("says so when Apollo knows no company, and stays quiet on a personal email domain", () => {
    expect(companyLines(served({ company: null, noCompanyReason: "not_found", person: null, personMatched: null }))).toEqual(["No company found for acme.com"]);
    expect(companyLines(served({ domain: "gmail.com", company: null, noCompanyReason: "personal_email_domain", person: null, personMatched: null }))).toEqual([]);
  });

  it("calls apollo-service directly with its own key, never Apollo", () => {
    const job = read("src/lib/visit-recap-job.ts");
    expect(job).toContain("/internal/company-firmographics");
    expect(job).toContain("process.env.APOLLO_SERVICE_URL");
    expect(job).toContain("process.env.APOLLO_SERVICE_API_KEY");
    expect(job).not.toContain("api.apollo.io");
  });
});

describe("returning visitor recap (owner 2026-10-07: tell me when someone comes back, anywhere)", () => {
  const dash = { pathname: "/v2/orgs/x" };

  it("sends a visit with no onboarding when the same person visited before, over 90 days", () => {
    expect(ENDED_VISITS_SQL).toContain("having onboarding > 0 or (prior_visits > 0 and last_seen < visit_started - interval 30 minute)");
    expect(ENDED_VISITS_SQL).toContain("p.sid != e.sid and p.started < e.started");
    expect(ENDED_VISITS_SQL).toContain("on p.pid = e.pid");
    expect(ENDED_VISITS_SQL).toContain("interval 90 day");
    expect(ENDED_VISITS_SQL).toContain("kevin.lourd@gmail.com");
  });

  it("reads the earlier visits off the row, and fails loud on a broken one", () => {
    expect(rowToVisit(["s1", 0, null, 1, "x"])).toEqual({ sessionId: "s1", returning: null });
    expect(rowToVisit(["s2", 3, "2026-10-01T10:00:00Z", 0, "x"])).toEqual({ sessionId: "s2", returning: { priorVisits: 3, lastSeenAt: "2026-10-01T10:00:00Z" } });
    expect(() => rowToVisit(["s3", 2, null, 0, "x"])).toThrow(/last-seen/);
    expect(() => rowToVisit(["s4", "n/a", null, 0, "x"])).toThrow(/prior visit count/);
  });

  it("opens with who came back, then the usual recap", () => {
    const text = visitRecap(
      [ev(0, { ...dash, email: "jane@acme.com", personName: "Jane Doe" }), click(30, "Deals", dash), ev(90, dash)],
      ["HQ 🇺🇸 United States · B2B SaaS · Software", "11-50 employees · $1M-$10M revenue · Head of Growth"],
      { priorVisits: 3, lastSeenAt: new Date(T0 - 2 * 86_400_000).toISOString() },
    );
    expect(text.split("\n").slice(0, 5)).toEqual([
      "🔁 <b>Back</b> · visit 4 in 90 days · last seen 2 days ago",
      "Jane Doe · jane@acme.com",
      "🇫🇷 France · 1 min 30 · <b>Reached the dashboard</b>",
      "Came direct, landed on the dashboard",
      "HQ 🇺🇸 United States · B2B SaaS · Software",
    ]);
  });

  it("says an anonymous returner never signed up, and a first visit gets no Back line", () => {
    const anon = visitRecap([ev(0, { host: "distribute.you", pathname: "/" })], [], { priorVisits: 1, lastSeenAt: new Date(T0 - 3 * 3_600_000).toISOString() });
    expect(anon.split("\n").slice(0, 2)).toEqual(["🔁 <b>Back</b> · visit 2 in 90 days · last seen 3 h ago", "Not signed up"]);
    expect(visitRecap([ev(0, {})])).not.toContain("Back");
  });

  it("prints how long ago in words", () => {
    expect(formatAgo(12 * 60_000)).toBe("12 min ago");
    expect(formatAgo(5 * 3_600_000)).toBe("5 h ago");
    expect(formatAgo(3 * 86_400_000)).toBe("3 days ago");
  });

  it("guesses the role when Apollo has no title, and says it is a guess (owner: find it in Apollo, or guess it)", () => {
    expect(guessRole("ceo@acme.com", "51-200")).toBe("Founder / CEO (guess, from the email)");
    expect(guessRole("sales@acme.com", null)).toBe("Sales (guess, from the email)");
    expect(guessRole("jane@acme.com", "1-10")).toBe("Founder (guess, 10 people or fewer)");
    expect(guessRole("jane@acme.com", "51-200")).toBeNull();
    expect(guessRole(null, "10,001+")).toBeNull();
    const lines = firmographicLines({ hqCountry: "US", industry: null, employeeRange: "1-10", revenueRange: null, category: null, role: null }, "jane@acme.com");
    expect(lines[1]).toBe("1-10 employees · Revenue unknown · Founder (guess, 10 people or fewer)");
    expect(firmographicLines({ hqCountry: null, industry: null, employeeRange: "1-10", revenueRange: null, category: null, role: "CTO" }, "ceo@acme.com")[1]).toContain("CTO");
  });
});
