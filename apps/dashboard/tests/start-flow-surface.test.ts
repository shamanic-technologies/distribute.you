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
    // Outcomes wear the STEP's tile (one per step, product-wide), channels their own
    // mark, funnels theirs; every rung of a path row wears its step tile too.
    expect(FLOW).toContain("mark={<FunnelStepMark stepKey={o.key}");
    expect(FLOW).toContain("mark: <FunnelStepMark stepKey={step.key}");
    expect(FLOW).not.toContain("FunnelLegMark");
    expect(FLOW).toContain("mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }}");
    expect(FLOW).toContain("{funnelMark(funnel.funnelKey)}");
    expect(FLOW).toContain("funnelGroups(offeredFunnels)");
    expect(FLOW).toContain("def={{ mark: channelMarkForSlug(f.channelSlug) }}");
    expect(PAY).toContain("{funnelMark(funnel.key)}");
  });

  it("a path is a full-width row with its whole path drawn, and an unsold path is named", () => {
    // One row per (funnel x channel), never a grid card that folds the path into pills.
    expect(FLOW).toContain("<StartPathOption");
    expect(FLOW).toContain("rungs={rungs}");
    expect(FLOW).toContain("funnelRungs(g.funnelKey, catalogue.wire)");
    expect(SHELL).toContain('aria-label="Path"');
    // Every rung a tile plus the producer's words, an arrow between.
    expect(SHELL).toContain("{r.mark}");
    expect(SHELL).toContain("<ArrowRightIcon");
    // A funnel the picks buy that no kept channel sells is stated with who would sell it.
    expect(FLOW).toContain("unsoldBoughtFunnels(catalogue.wire, outcomes, keptChannels)");
    expect(FLOW).toContain("{u.sellerNames.join(\", \")}");
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
    expect(SHELL).toContain("per paying client");
    // An unmeasured pairing says so on its row; the scope is never dropped.
    expect(SHELL).toContain("Not measured yet");
    expect(SHELL).toContain("every path included");
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
