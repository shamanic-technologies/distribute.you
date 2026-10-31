import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PATH_FINDER_TOKEN,
  formatExpected,
  goals,
  parseChannels,
  parseEconomics,
  parseSteps,
  parseTreg,
  routeSteps,
  pathFinderHtml,
  pathTools,
  pathsTo,
  tiles,
  toolCount,
  withPathFinder,
  type PathFinderData,
} from "../../src/lib/pages/gtm-path-finder";
import { renderGtmAutomationPage } from "../../src/lib/pages/gtm-automation";
import type { PlatformPrice } from "../../src/lib/pages/catalog";

/**
 * GTM-PATH-FINDER-1031: the treg.to/search copy on `/gtm-automation`. Every path, tool and
 * figure is read from the served channels, steps, expected costs and cost catalogue.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const step = (key: string, label: string) => ({ key, label, description: "d", shortDescription: "s" });
/** Shaped like `/v1/public/channels` on 2026-10-31. */
const CHANNELS_BODY = {
  channels: [
    {
      slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach", channelType: "outbound", performedBy: "software", displayOrder: 1,
      stepTransitions: [
        { legKey: "lead_found_to_conversation", from: step("lead_found", "Lead"), to: step("conversation", "Positive reply") },
        { legKey: "lead_found_to_website_visit", from: step("lead_found", "Lead"), to: step("website_visit", "Website visit") },
      ],
    },
    {
      slug: "linkedin-ads", name: "LinkedIn Ads", channelType: "paid", performedBy: "software", displayOrder: 12,
      stepTransitions: [
        { legKey: "website_visit", from: null, to: step("website_visit", "Website visit") },
        { legKey: "meeting_booked", from: null, to: step("meeting_booked", "Meeting booked") },
      ],
    },
    {
      slug: "agency-meeting-booking", name: "Agency Meeting Booking", channelType: "conversion", performedBy: "person", displayOrder: 30,
      stepTransitions: [{ legKey: "conversation_to_meeting_booked", from: step("conversation", "Positive reply"), to: step("meeting_booked", "Meeting booked") }],
    },
    {
      slug: "email-sending", name: "Email Sending", channelType: "outbound", performedBy: "software", displayOrder: 50,
      stepTransitions: [{ legKey: "conversation", from: null, to: step("conversation", "Positive reply") }],
    },
  ],
};
const STEPS_BODY = {
  object: "step",
  total: 5,
  rows: [
    { key: "lead_found", name: "Lead found" },
    { key: "conversation", name: "Positive reply" },
    { key: "website_visit", name: "Website visit" },
    { key: "meeting_booked", name: "Meeting booked" },
    { key: "paid_client", name: "Paid client" },
  ],
};
const ROUTES_TO_PAID = [
  { legKeys: ["lead_found_to_conversation", "conversation_to_meeting_booked", "meeting_booked_to_paid_client"] },
  { legKeys: ["lead_found_to_website_visit", "website_visit_to_meeting_booked", "meeting_booked_to_paid_client"] },
  { legKeys: ["lead_found_to_conversation", "conversation_to_paid_client"] },
];
const ECONOMICS_BODY = {
  channelSlug: null,
  channels: [
    {
      channelSlug: "sales-cold-email-outreach",
      outcomes: [
        { step: step("conversation", "Positive reply"), costPerOutcomeUsd: 319.278, paths: ROUTES_TO_PAID },
        { step: step("website_visit", "Website visit"), costPerOutcomeUsd: 15.27, paths: ROUTES_TO_PAID },
        { step: step("meeting_booked", "Meeting booked"), costPerOutcomeUsd: 1161.01, paths: ROUTES_TO_PAID },
      ],
    },
    { channelSlug: "email-sending", outcomes: [{ step: step("conversation", "Positive reply"), costPerOutcomeUsd: 2.18 }] },
    { channelSlug: "linkedin-ads", outcomes: [{ step: step("website_visit", "Website visit"), costPerOutcomeUsd: null }] },
  ],
};

function price(p: Partial<PlatformPrice> & { name: string; provider: string; type: string; unit: string; pricePerUnitInUsdCents: string }): PlatformPrice {
  return { providerDomain: `${p.provider}.com`, pricingBasis: "marked-up", status: "current", lastUsedOn: "2026-10-30", usageReadAt: "2026-10-31T01:00:00Z", bundle: null, ...p };
}
const PRICES: PlatformPrice[] = [
  price({ name: "apollo-credit", provider: "apollo", providerDomain: "apollo.io", type: "Credit", unit: "credit", pricePerUnitInUsdCents: "2.7" }),
  price({ name: "firecrawl-scrape", provider: "firecrawl", providerDomain: "firecrawl.dev", type: "Scrape credit", unit: "credit", pricePerUnitInUsdCents: "0.9" }),
  price({ name: "gemini-out", provider: "google", providerDomain: "google.com", type: "Output tokens (Gemini 3 Flash)", unit: "1M tokens", pricePerUnitInUsdCents: "0.0003" }),
  price({ name: "instantly-send", provider: "instantly", providerDomain: "instantly.ai", type: "Email send", unit: "email", pricePerUnitInUsdCents: "1.36" }),
  price({ name: "linkedin-ads-spend", provider: "linkedin-ads", providerDomain: "linkedin.com", type: "LinkedIn Ads platform spend", unit: "usd", pricePerUnitInUsdCents: "100", pricingBasis: "pass-through" }),
];

const DATA: PathFinderData = {
  channels: parseChannels(CHANNELS_BODY),
  stepLabels: parseSteps(STEPS_BODY),
  economics: parseEconomics(ECONOMICS_BODY),
  prices: PRICES,
};

describe("served shapes", () => {
  it("reads every channel with the steps it moves a lead to", () => {
    expect(DATA.channels).toHaveLength(4);
    expect(DATA.channels[1].transitions.map((t) => [t.from, t.to.key])).toEqual([[null, "website_visit"], [null, "meeting_booked"]]);
  });
  it("throws on a body it cannot read (the route drops the section)", () => {
    expect(() => parseChannels({ rows: [] })).toThrow();
    expect(() => parseSteps({})).toThrow();
  });
  it("keeps an unpriced outcome as null, never zero", () => {
    expect(DATA.economics?.get("linkedin-ads")?.get("website_visit")?.cost).toBeNull();
  });
});

describe("paths", () => {
  it("lists every channel reaching the goal, priced paths cheapest first", () => {
    expect(pathsTo("conversation", DATA).map((p) => [p.slug, p.expectedUsd])).toEqual([
      ["email-sending", 2.18],
      ["sales-cold-email-outreach", 319.278],
    ]);
    expect(pathsTo("meeting_booked", DATA).map((p) => p.slug)).toEqual(["sales-cold-email-outreach", "linkedin-ads", "agency-meeting-booking"]);
  });
  it("reads every served route to the goal: the shortest leads, the others are counted", () => {
    expect(routeSteps(["lead_found_to_conversation", "conversation_to_meeting_booked", "meeting_booked_to_paid_client"], "meeting_booked")).toEqual([
      "lead_found",
      "conversation",
      "meeting_booked",
    ]);
    expect(routeSteps(["lead_found_to_conversation", "conversation_to_paid_client"], "meeting_booked")).toBeNull();
    const cold = pathsTo("meeting_booked", DATA)[0];
    expect(cold).toMatchObject({ route: ["Lead found", "Positive reply", "Meeting booked"], routes: 2, expectedUsd: 1161.01 });
    expect(pathsTo("meeting_booked", DATA)[1].route).toEqual(["Meeting booked"]);
    const fromNothing = parseEconomics({
      channels: [{ channelSlug: "email-sending", outcomes: [{ step: step("conversation", "Positive reply"), costPerOutcomeUsd: 2, paths: [{ legKeys: ["start_to_conversation"] }] }] }],
    });
    expect(pathsTo("conversation", { ...DATA, economics: fromNothing }).find((p) => p.slug === "email-sending")?.route).toEqual(["Positive reply"]);
  });
  it("names who runs a path; a person-run path runs no tool", () => {
    const meeting = pathsTo("meeting_booked", DATA);
    expect(meeting[2]).toMatchObject({ who: "Our specialist", tools: [] });
    expect(meeting[0].who).toBe("Our AI agent");
  });
  it("draws the tools of a path from the live catalogue", () => {
    const email = pathTools(DATA.channels[0], PRICES).map((t) => t.label);
    expect(email).toEqual(["Apollo", "Firecrawl", "Google", "Instantly"]);
    expect(pathTools(DATA.channels[0], null)).toEqual([]);
    expect(pathTools(DATA.channels[1], PRICES).map((t) => t.domain)).toContain("linkedin.com");
  });
  it("drops a goal no channel reaches", () => {
    expect(goals(DATA).map((g) => g.key)).toEqual(["meeting_booked", "conversation", "website_visit"]);
  });
  it("adds treg's platforms and providers once, never a logo we already pile", () => {
    const treg = parseTreg({
      platforms: [{ slug: "linkedin", label: "LinkedIn" }, { slug: "douyin", label: "Douyin" }],
      providers: { apollo: "Apollo", tikhub: "TikHub" },
    });
    const t = tiles({ ...DATA, treg });
    expect(t.map((x) => x.key)).toEqual(expect.arrayContaining(["t:p:douyin", "t:v:tikhub"]));
    expect(t.map((x) => x.key)).not.toContain("t:p:linkedin");
    expect(t.map((x) => x.key)).not.toContain("t:v:apollo");
    expect(t.find((x) => x.key === "t:v:tikhub")?.src).toBe("https://treg.to/logos/tikhub.svg");
    expect(toolCount(PRICES, treg)).toBe((toolCount(PRICES) ?? 0) + 1);
    expect(() => parseTreg({ providers: {} })).toThrow();
  });
  it("one tile per logo, nothing without a logo", () => {
    const t = tiles(DATA);
    const domains = t.map((x) => x.domain).filter(Boolean);
    expect(new Set(domains).size).toBe(domains.length);
    expect(t.every((x) => x.domain)).toBe(true);
    expect(t.map((x) => x.domain)).toContain("linkedin.com");
  });
});

describe("markup", () => {
  const html = pathFinderHtml(DATA, "https://dashboard.distribute.you/sign-up");
  const prose = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  it("states the served counts on the pill", () => {
    expect(prose).toContain(`4 channels · ${toolCount(PRICES)} tools · 5 funnel steps`);
  });
  it("asks treg's question, the first goal as placeholder and the rest as chips", () => {
    expect(html).toContain("What does your growth<br><span>need to do?</span>");
    expect(html).toContain('placeholder="Book 20 meetings with US SaaS heads of growth"');
    expect(html).toContain('data-goal="conversation"');
    expect(html).not.toContain('class="pf-chip" type="button" data-goal="meeting_booked"');
  });
  it("labels every cost as expected and never prints a ROI", () => {
    const js = read("public/landing/v2/path-finder.js");
    expect(js).toContain("<li><span>Expected cost</span>");
    expect(js).toContain('<span class="pf-m">learning</span>');
    expect(html.toLowerCase()).not.toContain("roi");
  });
  it("a crawler reads the paths as a plain list", () => {
    expect(prose).toContain("Interested replies from my buyers");
    expect(prose).toContain("Email Sending, Sales Cold Email Outreach");
  });
  it("escapes the inline JSON", () => {
    const evil: PathFinderData = { ...DATA, channels: parseChannels({ channels: [{ ...CHANNELS_BODY.channels[0], name: "</script><b>x" }] }) };
    expect(pathFinderHtml(evil, "/s")).not.toContain("</script><b>");
  });
  it("no em or en dash in copy", () => {
    expect(prose).not.toMatch(/[—–]/);
  });
  it("a missing read drops the whole section", () => {
    expect(withPathFinder(`a${PATH_FINDER_TOKEN}b`, null, "/s")).toBe("ab");
    expect(withPathFinder(`a${PATH_FINDER_TOKEN}b`, DATA, "/s")).toContain('id="paths"');
  });
  it("formats an expected figure without false precision", () => {
    expect(formatExpected(1161.01)).toBe("$1,161");
    expect(formatExpected(2.183)).toBe("$2.18");
  });
});

describe("wiring", () => {
  it("the page holds the slot right after the hero, and loads its styles and script", () => {
    const page = renderGtmAutomationPage();
    expect(page.indexOf(PATH_FINDER_TOKEN)).toBeGreaterThan(page.indexOf('id="run"'));
    expect(page.indexOf(PATH_FINDER_TOKEN)).toBeLessThan(page.indexOf('class="gx-showcase"'));
    expect(page).toMatch(/\/landing\/v2\/path-finder\.css\?v=\d+/);
    expect(page).toMatch(/\/landing\/v2\/path-finder\.js\?v=\d+/);
  });
  it("the route resolves the slot from the served reads", () => {
    const route = read("src/app/gtm-automation/route.ts");
    expect(route).toContain("fetchPathFinderData(");
    expect(route).toContain("withPathFinder(");
  });
  it("matter.js and the pixel font are self-hosted, treg's physics kept", () => {
    expect(existsSync(path.join(ROOT, "public/landing/v2/vendor/matter-0.20.0.min.js"))).toBe(true);
    expect(existsSync(path.join(ROOT, "public/landing/v2/vendor/GeistPixel-Square.woff2"))).toBe(true);
    const js = read("public/landing/v2/path-finder.js");
    for (const v of ["y: 1.1, scale: 0.001", "restitution: 0.12", "friction: 0.55", "frictionStatic: 0.9", "frictionAir: 0.012", "density: 0.0016", "b.inertia * 8", "CAP = 38", "i * 10"]) {
      expect(js).toContain(v);
    }
  });
});
