import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANNEL_MARKS } from "../src/lib/acquisition-channels";
import { DEFAULT_CHANNEL_SLUG } from "../src/lib/start-catalogue";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const SHELL = read("components/start/start-shell.tsx");
const FLOW = read("components/start/start-flow.tsx");
const PAY = read("components/start/pay-flow.tsx");
const BUILD = read("components/start/build-flow.tsx");
const ALL = [SHELL, FLOW, PAY, BUILD];

/** Every channel slug production publishes on 2026-09-18, read off
 *  `GET /public/channels` inside the features-service container. Nothing on this
 *  flow lists them any more (we run one channel and the screen that asked is
 *  gone), but the marks are still what every OTHER surface draws, so a slug
 *  published upstream without one is a blank tile somewhere. */
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
    // Outcomes wear the STEP's tile (one per step, product-wide), a path its
    // FUNNEL's; every rung of a path row wears its step tile too.
    expect(FLOW).toContain("mark={<FunnelStepMark stepKey={o.key}");
    expect(FLOW).toContain("mark: <FunnelStepMark stepKey={step.key}");
    expect(FLOW).not.toContain("FunnelLegMark");
    expect(FLOW).toContain("mark={funnelMark(f.funnelKey)}");
    expect(FLOW).toContain("{funnelMark(funnel.funnelKey)}");
    expect(PAY).toContain("{funnelMark(funnel.key)}");
  });

  it("a path is a full-width row per FUNNEL, its whole path drawn, no channel on it", () => {
    // One row per funnel: the channel is the same on every row, so naming it on
    // each one states the only answer there is over and over.
    expect(FLOW).toContain("<StartPathOption");
    expect(FLOW).toContain("rungs={rungs}");
    expect(FLOW).toContain("title={f.funnelName}");
    expect(FLOW).toContain("funnelRungs(f.funnelKey, catalogue.wire)");
    expect(FLOW).not.toContain("funnelGroups");
    expect(SHELL).toContain('aria-label="Path"');
    // Every rung a tile plus the producer's words, an arrow between.
    expect(SHELL).toContain("{r.mark}");
    expect(SHELL).toContain("<ArrowRightIcon");
    // The title is the path's own name now, and a name cut in half is not the
    // name: measured on a Pixel 7, "Sales Meeting from Positive Reply" lost the
    // half that tells it from "Sales Meeting from Website".
    expect(SHELL).toContain(
      '<span className="min-w-0 font-display text-base font-medium leading-tight text-gray-900">',
    );
  });

  it("asks TWO questions and never a channel, but still carries the channel it runs", () => {
    // The channel screen offered one real answer, so it cost a step of the funnel
    // to collect nothing. What is bought is still a (funnel x channel) pair.
    expect(FLOW).not.toContain('"channels"');
    expect(FLOW).not.toContain("channelGroups");
    expect(FLOW).toContain('const ORDER: Screen[] = ["welcome", "outcome", "funnels", "returns"];');
    expect(FLOW).toContain("const STEP_COUNT = 3;");
    expect(FLOW).toContain("channels: [DEFAULT_CHANNEL_SLUG]");
    expect(DEFAULT_CHANNEL_SLUG).toBe("sales-cold-email-outreach");
    // Each question states its own position out of the two.
    expect(FLOW).toContain("step={1}\n        stepCount={STEP_COUNT}");
    expect(FLOW).toContain("step={2}\n        stepCount={STEP_COUNT}");
    expect(FLOW).toContain("step={3}\n      stepCount={STEP_COUNT}");
  });

  it("reads the stored channel list on NEITHER payment screen, so an older cookie resolves", () => {
    // A selection stored while the channel screen existed can name channels we
    // never ran. Narrowing beats refusing: `paid` is the only record money was taken.
    expect(PAY).not.toContain("selection.channels.includes");
    expect(BUILD).not.toContain("selection.channels.includes");
    expect(PAY).toContain("channelsForOutcomes(wire, selection.outcomes)");
    expect(BUILD).toContain("channelsForOutcomes(wire, selection.outcomes)");
  });

  it("bleeds the scroll box so a selected card's ring is not clipped at the edge", () => {
    // ring-2 sits OUTSIDE the border; an overflow box with no padding cuts it off.
    expect(SHELL).toContain('className="-m-1 mt-5 min-h-0 flex-1 overflow-y-auto p-1"');
  });

  it("every screen change starts at the top of the scroll box, never where the last one left it", () => {
    // The scroll box is ONE element across screens (same position in the tree),
    // so its scrollTop survives a screen change; a visitor who scrolled the
    // channel list to the bottom arrived on the next screen already at the bottom.
    expect(SHELL).toContain("const bodyRef = useRef<HTMLDivElement>(null);");
    expect(SHELL).toContain("bodyRef.current?.scrollTo({ top: 0 });");
    expect(SHELL).toContain("}, [step, scrollKey]);");
    expect(SHELL).toContain("ref={bodyRef}");
    // Every screen of the start flow names itself, so a same-step re-render
    // (the funnel screen re-picked) cannot be told apart from a new screen.
    expect(FLOW).toContain("scrollKey={screen}");
  });

  it("the returns screen is one compact row per path, made to fit without scrolling", () => {
    const at = FLOW.indexOf("// returns");
    const returns = FLOW.slice(at);
    // One row per (funnel x channel), a figure on the row, the cost on the right:
    // no per-funnel section, no card grid (the cards were what pushed it past the fold).
    expect(returns).toContain("<StartReturnRow");
    expect(returns).not.toContain("<StartGrid>");
    expect(returns).not.toContain("<h2");
    expect(SHELL).toContain("export function StartReturnRow(");
    expect(SHELL).toContain("back per dollar");
    // The headline is the middle half (p25 to p75), the median sits under it as
    // "median ROI", and the line states the best workflow's first-step price.
    // The cost per paying client and the client count are gone: owner-cut.
    expect(SHELL).toContain("median ROI");
    expect(SHELL).not.toContain("per paying client");
    expect(SHELL).not.toContain("for the middle half");
    expect(SHELL).not.toContain("clients on this");
    expect(SHELL).toContain("firstStepLine");
    // The channel is not named on a row: there is one, so "via X" is a non-choice.
    expect(SHELL).not.toContain("channelMark");
    expect(returns).not.toContain("channelName");
    expect(returns).not.toContain("No charge until");
    // An unmeasured path says so on its row.
    expect(SHELL).toContain("Not measured yet");
    // The commitment is a tag off the channel's terms, never a "judge it after" line.
    expect(FLOW).toContain("commitmentTag(f.effectiveMinimumCommitmentDays)");
    expect(FLOW).not.toContain("Judge it after");
    // The named clients ride beside the rows, from the SAME producer read as the homepage.
    expect(returns).toContain("proofCardsFor(");
    expect(returns).toContain("<StartProofCard");
    expect(SHELL).toContain("export function StartProofCard(");
  });

  it("the last CTA reads as a reward, in the owner's words", () => {
    expect(FLOW).toContain("Excellent, create my account");
    expect(FLOW).not.toMatch(/>\s*Create my account\s*</);
  });

  it("a price reads 'From $X per day', never '$X/day'", () => {
    for (const src of ALL) {
      expect(src).not.toMatch(/\}\/day/);
      expect(src).not.toMatch(/\$\{[^}]*\}\/day/);
    }
    expect(SHELL).toContain("return `From $${Math.round(cents / 100).toLocaleString(\"en-US\")} per day`;");
    expect(FLOW).toContain("fromPerDay(f.dailyOperatingCostCents)");
    expect(PAY).toContain("fromPerDay(funnel.dailyOperatingCostCents)");
  });

  it("the funnel screen is filtered by the picked OUTCOMES, on every reader of the selection", () => {
    expect(FLOW).toContain("funnelsForChannels(keptChannels, outcomes,");
    expect(PAY).toContain("funnelsForChannels(kept, selection.outcomes,");
    expect(BUILD).toContain("funnelsForChannels(kept, selection.outcomes,");
  });

  it("options sit in a three-across grid on desktop", () => {
    expect(SHELL).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4");
    // The group label existed for the channel screen's families and went with it.
    expect(SHELL).not.toContain("export function StartGroupLabel");
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
