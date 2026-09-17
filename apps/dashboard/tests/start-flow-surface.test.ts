import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANNEL_MARKS } from "../src/lib/acquisition-channels";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const SHELL = read("components/start/start-shell.tsx");
const FLOW = read("components/start/start-flow.tsx");
const PAY = read("components/start/pay-flow.tsx");
const BUILD = read("components/start/build-flow.tsx");
const ALL = [SHELL, FLOW, PAY, BUILD];

/** Every channel slug production publishes on 2026-09-17, read off
 *  `GET /public/channels` inside the features-service container. A slug added
 *  upstream renders markless (which the mark component tolerates); a slug HERE
 *  without a mark is a card on the channel screen with an empty tile. */
const PROD_SLUGS = [
  "sales-cold-email-outreach", "pr-cold-email-outreach", "pr-expert-quote-outreach",
  "sales-crm-email-outreach", "feedback-request-cold-email-outreach", "cold-call-outreach",
  "cold-sms-outreach", "cold-whatsapp-outreach", "cold-linkedin-outreach", "cold-x-outreach",
  "cold-instagram-outreach", "cold-reddit-outreach", "google-ads", "meta-ads", "linkedin-ads",
  "tiktok-ads", "youtube-ads", "x-ads", "reddit-ads", "bing-ads", "quora-ads",
  "newsletter-sponsorships", "podcast-sponsorships", "creator-sponsorships",
  "paid-directory-listings", "seo-content", "press-placements", "podcast-guesting",
  "affiliate-programme", "organic-linkedin-publishing", "organic-x-publishing",
  "organic-reddit-publishing", "organic-youtube-publishing", "ai-meeting-booking",
  "agency-meeting-booking", "your-team-meeting-booking", "agency-meeting-attendance",
  "your-team-meeting-attendance", "agency-closing-calls", "your-team-closing-calls",
  "agency-signup-conversion", "your-team-signup-conversion",
];

describe("the signed-out onboarding wears the landing's charter", () => {
  it("every published channel has a mark, so no option card is a blank tile", () => {
    const missing = PROD_SLUGS.filter((s) => !CHANNEL_MARKS[s]);
    expect(missing).toEqual([]);
  });

  it("every option on every screen carries a mark at the call site", () => {
    // Outcomes wear the entry-leg glyph, channels their own mark, funnels theirs.
    expect(FLOW).toContain("mark={<FunnelLegMark fromKey={null} toKey={o.key}");
    expect(FLOW).toContain("mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }}");
    expect(FLOW).toContain("{funnelMark(funnel.funnelKey)}");
    expect(FLOW).toContain("funnelGroups(offeredFunnels)");
    expect(FLOW).toContain("def={{ mark: channelMarkForSlug(f.channelSlug) }}");
    expect(PAY).toContain("{funnelMark(funnel.key)}");
  });

  it("a price reads 'From $X per day', never '$X/day'", () => {
    for (const src of ALL) {
      expect(src).not.toMatch(/\}\/day/);
      expect(src).not.toMatch(/\$\{[^}]*\}\/day/);
    }
    expect(SHELL).toContain("return `From $${Math.round(cents / 100).toLocaleString(\"en-US\")} per day`;");
    expect(FLOW).toContain("fromPerDay(c.terms.dailyOperatingCostCents)");
    expect(FLOW).toContain("fromPerDay(f.dailyOperatingCostCents)");
    expect(PAY).toContain("fromPerDay(funnel.dailyOperatingCostCents)");
  });

  it("the funnel screen is filtered by the picked OUTCOMES, on every reader of the selection", () => {
    expect(FLOW).toContain("funnelsForChannels(keptChannels, outcomes,");
    expect(PAY).toContain("funnelsForChannels(kept, selection.outcomes,");
    expect(BUILD).toContain("funnelsForChannels(kept, selection.outcomes,");
  });

  it("options sit in a three-across grid on desktop, grouped by family on the channel screen", () => {
    expect(SHELL).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4");
    expect(FLOW).toContain("channelGroups(offeredChannels)");
    expect(FLOW).toContain("<StartGroupLabel");
  });

  it("the shell shows the brand the landing named, and only then", () => {
    expect(SHELL).toContain("landingBrandFromCookie(document.cookie)");
    expect(SHELL).toContain("data-landing-brand={brand.host}");
    expect(SHELL).toContain("<BrandLogo domain={brand.host}");
    // Absent brand: the offer pill, never a guessed host.
    expect(SHELL).toContain("First $30 free");
  });

  it("wears the landing: display face, hero glow, logo, trust strip off a floored count", () => {
    expect(SHELL).toContain("font-display");
    expect(SHELL).toContain("bg-brand-100 opacity-40 blur-3xl");
    expect(SHELL).toContain('src="/logo-distribute.svg"');
    expect(SHELL).toContain("data-founder-count");
    expect(SHELL).toContain("foundersFloor(founders)");
    // Never `0+ founders`: below one floor the shipped literal stays.
    expect(SHELL).toContain('"Loved by 70+ founders"');
  });

  it("reveals cards with the landing's stagger and pops a fresh pick, both off under reduced motion", () => {
    const css = read("app/globals.css");
    expect(css).toContain("@keyframes start-enter");
    expect(css).toContain(".start-pop { animation: none; }");
    expect(SHELL).toContain('"--enter-delay"');
    expect(SHELL).toContain("start-pop");
    expect(SHELL).toContain("prefers-reduced-motion: reduce");
  });

  it("carries no em-dash in anything a visitor reads", () => {
    for (const src of ALL) {
      const copy = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      expect(copy).not.toContain("—");
    }
  });

  /**
   * This guard used to pin `readPublic("stats/users")` -- the call was SPELLED
   * correctly and pointed at a path the gateway 404s, so the count was null on
   * every request and the strip rendered its shipped seed. A spelling is not a
   * connection: pin the PREFIX, which is the half that was wrong.
   */
  it("reads the founder count off the gateway's unversioned public path", () => {
    const route = read("app/api/public/catalogue/route.ts");
    expect(route).toContain('readGatewayPublic("stats/users")');
    expect(route).not.toContain('readPublic("stats/users")');
    expect(route).toContain("founders");
  });
});
