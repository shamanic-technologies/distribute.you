import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANNEL_MARKS } from "../src/lib/acquisition-channels";
import { DEFAULT_CHANNEL_SLUG } from "../src/lib/start-catalogue";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const SHELL = read("components/start/start-shell.tsx");
const FLOW = read("components/start/start-picks.tsx");
const ALL = [SHELL, FLOW];

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
    // Outcomes wear the STEP's tile (one per step, product-wide); every campaign
    // row on the results screen wears its LEG's tile.
    expect(FLOW).toContain("mark={<StepMark stepKey={o.key}");
    expect(FLOW).toContain("<LegMark fromKey={c.fromKey} toKey={c.toKey}");
  });

  it("asks ONE question, never a channel or a path, and walks one stepper", () => {
    // Picking an outcome names the campaigns that reach it, so no later screen
    // asks which path or which channel.
    expect(FLOW).not.toContain('"channels"');
    expect(FLOW).not.toContain('"path"');
    expect(FLOW).toContain('export const START_SCREEN_ORDER: StartScreen[] = ["welcome", "outcome", "returns"];');
    // ONE stepper for the whole flow, from the landing to the account.
    expect(FLOW).toContain('export const START_STEP_LABELS = ["Goal", "Results", "Your setup", "Review"] as const;');
    expect(DEFAULT_CHANNEL_SLUG).toBe("sales-cold-email-outreach");
    // Each question states its own position out of the whole.
    expect(FLOW).toContain("step={1}\n        stepCount={START_STEP_COUNT}");
    expect(FLOW).toContain("step={2}\n      stepCount={START_STEP_COUNT}");
  });

  it("derives the campaigns from the picked outcomes, off the published catalogue", () => {
    expect(FLOW).toContain("pairsForOutcomes(outcomes, catalogue.wire)");
    expect(FLOW).toContain("legsTo(o.key, catalogue.wire)");
  });

  it("bleeds the scroll box so a selected card's ring is not clipped at the edge", () => {
    // ring-2 sits OUTSIDE the border; an overflow box with no padding cuts it off.
    expect(SHELL).toContain("-m-1 min-h-0 flex-1 overflow-y-auto p-1");
  });

  it("every screen change starts at the top of the scroll box, never where the last one left it", () => {
    // The scroll box is ONE element across screens (same position in the tree),
    // so its scrollTop survives a screen change.
    expect(SHELL).toContain("const bodyRef = useRef<HTMLDivElement>(null);");
    expect(SHELL).toContain("bodyRef.current?.scrollTo({ top: 0 });");
    expect(SHELL).toContain("}, [step, scrollKey]);");
    expect(SHELL).toContain("ref={bodyRef}");
    expect(FLOW).toContain("scrollKey={screen}");
  });

  it("the results screen is one compact row per campaign, its channel and price on it", () => {
    const at = FLOW.indexOf("// returns");
    const returns = FLOW.slice(at);
    expect(returns).toContain("campaigns.map((c, i) => (");
    expect(returns).toContain("Via {c.channelName}");
    expect(returns).toContain("{fromPerDay(c.dailyOperatingCostCents)}");
    expect(returns).not.toContain("<StartGrid>");
    // An empty set is stated, never an empty list.
    expect(returns).toContain("None of our channels reaches what you picked yet.");
    // The named clients are the TOP THREE by return, drawn in a random order
    // stable for the visit, and they sit OUTSIDE the white card: the shell's
    // `aside` slot, never inside the scroll box.
    expect(returns).toContain("proofCardsFor(proof?.showcase ?? [])");
    expect(FLOW).toContain("shuffleWithSeed(");
    expect(FLOW).toContain("useState(() => Math.random())");
    expect(returns).toContain("aside={");
    expect(returns).toContain("<StartProofCard");
    expect(SHELL).toContain("export function StartProofCard(");
    expect(SHELL).toContain("data-start-aside");
    // The aside renders AFTER the card's footer, i.e. as a sibling of the white card.
    const cardFooter = SHELL.indexOf("{footer}</div>");
    const asideAt = SHELL.indexOf("data-start-aside");
    expect(cardFooter).toBeGreaterThan(0);
    expect(asideAt).toBeGreaterThan(cardFooter);
  });

  it("the last CTA says what it does: continue into the wizard, no account yet", () => {
    expect(FLOW).toContain("See what we&apos;d build for you");
    expect(FLOW).not.toContain("create my account");
    expect(FLOW).not.toMatch(/>\s*Create my account\s*</);
  });

  it("a price reads 'From $X per day', never '$X/day'", () => {
    for (const src of ALL) {
      expect(src).not.toMatch(/\}\/day/);
      expect(src).not.toMatch(/\$\{[^}]*\}\/day/);
    }
    expect(SHELL).toContain("return `From $${Math.round(cents / 100).toLocaleString(\"en-US\")} per day`;");
  });

  it("options sit in a three-across grid on desktop", () => {
    expect(SHELL).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4");
    // The welcome's three pillars fill the width in three columns, never the
    // four-column option grid (which left an empty fourth column at xl).
    const welcome = FLOW.slice(FLOW.indexOf('if (screen === "welcome")'), FLOW.indexOf('if (screen === "outcome")'));
    expect(welcome).not.toContain("<StartGrid>");
    expect(welcome).toContain("grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4");
    expect(SHELL).not.toContain("export function StartGroupLabel");
  });

  it("the shell shows the brand the landing named, and only then", () => {
    expect(SHELL).toContain("landingBrandFromCookie(document.cookie)");
    expect(SHELL).toContain("data-landing-brand={brand.host}");
    expect(SHELL).toContain("<BrandLogo domain={brand.host}");
    // And at the head of every screen's card: their logo and host, host only
    // (no brand name exists before signup).
    expect(SHELL).toContain("data-landing-brand-eyebrow={brand.host}");
    expect(SHELL).toContain("Setting this up for");
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
