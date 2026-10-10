import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  DEFAULT_SIGNUP_DRAFT,
  dailyPaceUsd,
  estimatedLine,
  signupFunnelsFrom,
  signupLaunchPlan,
} from "../src/lib/v2/signup-campaign";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const PAGE = read("src/components/v2/get-started/get-started.tsx");
const LAUNCH = read("src/components/v2/get-started/launch.ts");
const WALL = read("src/components/v2/get-started/account-card-wall.tsx");
const KEEL = read("src/components/v2/keel.css");


// The END of signup (owner sketch 2026-10-10): ONE campaign, its caps, then the wall.
const row = (o: Record<string, unknown>) => ({ face: "/f.svg", line: "x", costUsd: null, costPer: null, roi: null, runnable: true, mixed: false, ...o });
const PAGES = {
  proactive: {
    rows: [
      row({ id: "mixed@x", name: "Mixed", type: "proactive", mixed: true, runnable: false }),
      row({ id: "best@cold", name: "Epiphany", type: "proactive", costUsd: 143.48, costPer: "per paying client", roi: 17.42 }),
      row({ id: "second@cold", name: "Zenith", type: "proactive", costUsd: 2748.69, costPer: "per paying client", roi: 0.91 }),
    ],
  },
  reactive: { rows: [row({ id: "meet@ai", name: "Motivate", type: "reactive" })] },
};

describe("Your campaign: features-service's funnels, picked as served", () => {
  it("takes the first runnable proactive funnel (the producer ranks ROI first) and the reactive one", () => {
    const f = signupFunnelsFrom(PAGES);
    expect(f.proactive).toMatchObject({ salesFunnelId: "best@cold", name: "Epiphany", roi: 17.42 });
    expect(f.reactive).toMatchObject({ salesFunnelId: "meet@ai", name: "Motivate" });
    expect(signupFunnelsFrom({ proactive: { rows: [] }, reactive: { rows: [] } })).toEqual({ proactive: null, reactive: null });
    expect(() => signupFunnelsFrom({ proactive: {} })).toThrow();
  });

  it("states the served cost with its unit, and nothing when none is served", () => {
    expect(estimatedLine({ costUsd: 143.48, costPer: "per paying client" })).toBe("Estimated: $143 per paying client");
    expect(estimatedLine({ costUsd: 42.5, costPer: "per meeting booked" })).toBe("Estimated: $42.50 per meeting booked");
    expect(estimatedLine({ costUsd: null, costPer: null })).toBeNull();
  });

  it("opens on $20 a day, no volume cap, meetings off at up to $10 a week (the sketch)", () => {
    expect(DEFAULT_SIGNUP_DRAFT).toEqual({ budget: "20", budgetPeriod: "daily", volume: "", volumePeriod: "monthly", reactiveOn: false, reactiveBudget: "10", reactivePeriod: "weekly" });
  });

  it("launches the max budget in cents with an optional volume, and the meeting funnel only when ticked", () => {
    const funnels = signupFunnelsFrom(PAGES);
    const r = signupLaunchPlan(DEFAULT_SIGNUP_DRAFT, funnels);
    expect(r).toEqual({ plan: { proactive: { salesFunnelId: "best@cold", name: "Epiphany", caps: { maxBudget: { amountCents: 2000, period: "daily" }, maxVolume: null } }, reactive: null } });
    const on = signupLaunchPlan({ ...DEFAULT_SIGNUP_DRAFT, volume: "500", reactiveOn: true }, funnels);
    expect("plan" in on && on.plan.proactive.caps.maxVolume).toEqual({ count: 500, period: "monthly" });
    expect("plan" in on && on.plan.reactive).toEqual({ salesFunnelId: "meet@ai", name: "Motivate", caps: { maxBudget: { amountCents: 1000, period: "weekly" }, maxVolume: null } });
  });

  it("refuses a missing or broken max budget (a funnel without one is held unfunded), a bad volume, a bad meeting budget", () => {
    const funnels = signupFunnelsFrom(PAGES);
    expect(signupLaunchPlan({ ...DEFAULT_SIGNUP_DRAFT, budget: "" }, funnels)).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...DEFAULT_SIGNUP_DRAFT, budget: "12.5" }, funnels)).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...DEFAULT_SIGNUP_DRAFT, volume: "lots" }, funnels)).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...DEFAULT_SIGNUP_DRAFT, reactiveOn: true, reactiveBudget: "0" }, funnels)).toHaveProperty("problem");
    expect(signupLaunchPlan(DEFAULT_SIGNUP_DRAFT, { proactive: null, reactive: null })).toHaveProperty("problem");
  });

  it("paces the reload warning on the budget typed: a day x1, a week /7, a month /30", () => {
    expect(dailyPaceUsd({ budget: "20", budgetPeriod: "daily" })).toBe(20);
    expect(dailyPaceUsd({ budget: "70", budgetPeriod: "weekly" })).toBe(10);
    expect(dailyPaceUsd({ budget: "300", budgetPeriod: "monthly" })).toBe(10);
    expect(dailyPaceUsd({ budget: "", budgetPeriod: "daily" })).toBe(0);
  });
});

describe("what we launch: caps first, then ONE funnel campaign (owner 2026-10-10)", () => {
  it("writes billing's caps before campaign-service starts the funnel campaign", () => {
    const fn = LAUNCH.slice(LAUNCH.indexOf("async function launchFunnel("), LAUNCH.indexOf("export async function launchFromPreview("));
    expect(fn.indexOf("await saveSalesFunnelCaps(")).toBeGreaterThan(0);
    expect(fn.indexOf("await saveSalesFunnelCaps(")).toBeLessThan(fn.indexOf("await startSalesFunnelCampaign("));
  });

  it("starts no pre-funnel campaign and writes no sales path, channel or per-piece budget", () => {
    for (const gone of ["createCampaignWithoutBrandEnrichment", "startReactiveCampaign", "saveOfferCampaignBudget", "saveOfferSalesPath", "saveOfferChannels", "saveOfferSelectedSalesPaths"]) {
      expect(LAUNCH, gone).not.toContain(gone);
      expect(PAGE, gone).not.toContain(gone);
    }
  });

  it("starts the proactive one first and lands on it", () => {
    const fn = LAUNCH.slice(LAUNCH.indexOf("export async function launchFromPreview("));
    expect(fn.indexOf("input.plan.proactive")).toBeLessThan(fn.indexOf("input.plan.reactive"));
    expect(fn).toContain("return firstId;");
  });

  it("the page opens the step from the email step, checks the plan, then opens the wall", () => {
    expect(PAGE).toContain("Set up my campaign");
    const confirm = PAGE.slice(PAGE.indexOf("function confirmCampaign("), PAGE.indexOf("/** Step 6: what one client is worth"));
    expect(confirm.indexOf("signupLaunchPlan(")).toBeLessThan(confirm.indexOf("setWallOpen(true)"));
    expect(PAGE).toContain("plan={launchPlan}");
  });

  it("speaks no funnel, pipe, leg or sales path words to the visitor", () => {
    const stage = PAGE.slice(PAGE.indexOf("function CampaignStage("), PAGE.indexOf("/** Step 6: what one client brings"));
    const words = stage.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // Every quoted string and every JSX text run the visitor can read.
    const shown = [...(words.match(/"[^"\n]*"/g) ?? []), ...(words.match(/>[^<>{}\n]+</g) ?? [])].join("\n");
    expect(shown).toContain("Your campaign");
    expect(shown).not.toMatch(/funnel|pipe|\bleg\b|sales path/i);
    expect(stage).toContain('title="Your campaign"');
    expect(stage).toContain("Max budget");
    expect(stage).toContain("Max volume");
    expect(stage).toContain("Also let our AI book meetings when someone replies");
  });
});

describe("a click moves on at once, and Back goes one step back", () => {
  it("advances the stage on the click, before the write lands, and reopens the step if it fails", () => {
    const pickOffer = PAGE.slice(PAGE.indexOf("function pickOffer("), PAGE.indexOf("async function confirmValue("));
    expect(pickOffer.indexOf('advance("offer")')).toBeLessThan(pickOffer.indexOf("await confirmBrandOffers"));
    const value = PAGE.slice(PAGE.indexOf("async function confirmValue("), PAGE.indexOf("async function confirmLevers("));
    expect(value.indexOf('advance("value")')).toBeLessThan(value.indexOf("await saveOfferLifetimeRevenue"));
    expect(value).toContain('reopen("value",');
    const pickAud = PAGE.slice(PAGE.indexOf("function pickAudience("), PAGE.indexOf("function chooseAudience("));
    expect(pickAud.indexOf('advance("audience")')).toBeLessThan(pickAud.indexOf("await ensureOffer()"));
  });

  it("writes the emails only once the give lists are SAVED", () => {
    const gives = PAGE.slice(PAGE.indexOf("async function confirmGives("), PAGE.indexOf("\n  }\n", PAGE.indexOf("async function confirmGives(")));
    expect(gives.indexOf("await saveOfferUserFields")).toBeLessThan(gives.indexOf("setAnswered(true)"));
  });

  it("draws a grey Back on every step but the first", () => {
    expect(PAGE).toContain("previousStep(stagedKey) ? () => goBack(stagedKey) : null");
  });

  it("says nothing on a step waiting for a pick", () => {
    expect(PAGE).not.toContain("Your pick");
    expect(PAGE).not.toContain("We ticked what we read on your site");
  });

  it("shows each audience's market size, big, from human-service's estimate", () => {
    expect(PAGE).toContain("<AudienceSize count={a.estimatedLeadCount ?? counts[a.name]}");
    expect(PAGE).toContain("if (e.estimatedPeople != null) counts[e.name] = e.estimatedPeople;");
  });

  it("calls the emails step a preview", () => {
    expect(PAGE).toContain('"Preview my emails"');
    expect(PAGE).not.toContain('"Write my emails"');
  });
});

import { leadCountLabel, previousStep } from "../src/lib/v2/get-started";
describe("market size and back helpers", () => {
  it("writes a lead count as a big figure, no tilde", () => {
    expect(leadCountLabel(14183)).toBe("14K leads");
    expect(leadCountLabel(3433)).toBe("3.4K leads");
    expect(leadCountLabel(820)).toBe("820 leads");
    expect(leadCountLabel(1_250_000)).toBe("1.3M leads");
    expect(leadCountLabel(null)).toBeNull();
  });
  it("goes back one step", () => {
    expect(previousStep("company")).toBeNull();
    expect(previousStep("campaign")).toBe("email");
  });
});

describe("the payment wall, simplified", () => {
  it("never closes on a click outside the panels (only × or Escape)", () => {
    expect(WALL).not.toContain("if (e.target === e.currentTarget && !busy && stage !== \"launching\") onClose();");
  });

  it("freezes the walk behind an open wall", () => {
    expect(PAGE).toContain("if (wallOpen) return;\n    const mv = stageMove(phases, stageIdx);");
  });

  it("asks Google OR email, with the email field right above its button, and no budget on the wall", () => {
    const form = WALL.slice(WALL.indexOf('{stage === "account" ? ('), WALL.indexOf("</form>", WALL.indexOf('{stage === "account" ? (')));
    expect(form.indexOf("Continue with Google")).toBeLessThan(form.indexOf("Continue with Email"));
    expect(form.indexOf('placeholder="you@company.com"')).toBeLessThan(form.indexOf("copy.emailCta}"));
    expect(WALL).not.toContain("budgetRow");
    expect(WALL).toContain("if (!checkReady()) return;");
  });

  it("carries real testimonials with five stars, from people the homepage names", () => {
    for (const n of ["Christian Lemke", "Katherine Fleishman", "Andrew Becker"]) expect(WALL).toContain(n);
    expect(WALL).toContain("★★★★★");
    expect(WALL).toContain("<Testimonials />");
  });

  it("shows no masked surname, no address and no vendor on a lead", () => {
    expect(PAGE).not.toContain("[r.person.firstName, r.person.lastNameObfuscated]");
    expect(PAGE).not.toContain("found via");
    expect(PAGE).not.toContain("maskedEmail ??");
    // The live email check is gone before payment (owner 2026-10-06), so is its label.
    expect(PAGE).not.toContain("RowCheck");
  });
});

describe("batch: wall, urgency, Back in the card, purchase rule", () => {
  it("draws Back inside the card, on the Continue line", () => {
    expect(PAGE).toContain("const BackContext = createContext<(() => void) | null>(null);");
    expect(PAGE).toContain("{onBack && <BackLink onBack={onBack} />}");
    expect(PAGE).toContain("<BackContext.Provider value={previousStep(stagedKey) ? () => goBack(stagedKey) : null}>");
  });

  it("frames the sign-up panel with its own headline", () => {
    expect(WALL).toContain("ring-2 ring-[var(--accent)]");
    expect(WALL).toContain("{copy.formTitle}");
  });

  // Owner 2026-10-01: signing up must be the first thing anyone wants to click.
  it("makes the sign-up buttons the biggest thing on the wall, labelled with the gain", () => {
    const form = WALL.slice(WALL.indexOf('{stage === "account" ? ('), WALL.indexOf("</form>", WALL.indexOf('{stage === "account" ? (')));
    // keel.css is unlayered, so a Tailwind h-12 loses to the 28px control: size with k-cta.
    expect(KEEL).toContain(".v2-root .k-cta { height: 48px;");
    // Two equal choices in one colour (owner 2026-10-01: "Continue with Google / Continue with
    // Email, même CTA color"): Google's dark theme (its guidelines forbid our accent), email alike;
    // the email field opens on its click.
    expect(form).not.toContain("k-btn-accent");
    expect(form.match(/className="k-cta k-cta-dark w-full justify-center gap-3"/g)?.length).toBe(2);
    expect(form).toContain("Continue with Google\n");
    expect(form).toContain("Continue with Email\n");
    expect(form).toContain("onClick={() => setEmailOpen(true)}");
    expect(KEEL).toContain("background: #131314; color: #fff; box-shadow: inset 0 0 0 1px #8e918f;");
    expect(WALL).not.toContain("Email me a code");
    // Owner 2026-10-01 (second pass): the scarcity and the steps come first, the buttons under them,
    // and the headline carries no accent fill (it read as one more button).
    expect(WALL.indexOf("<TrialTimer ")).toBeLessThan(WALL.indexOf("Continue with Google"));
    expect(WALL.indexOf("<Steps stage={stage} />")).toBeLessThan(WALL.indexOf("Continue with Google"));
    expect(WALL).not.toContain('<div className="bg-[var(--accent)] px-5 py-4 text-white">');
    // On a phone the form comes first.
    expect(WALL).toContain("order-first");
  });
});

describe("gain, never cost, on the selling screens (owner 2026-10-01)", () => {
  it("headlines no cost on the wall", () => {
    expect(PAGE).not.toContain("Where your money goes");
    expect(WALL).not.toContain("per hot lead");
  });

  it("shows a company's country as a flag in the first column, no Location column", async () => {
    const { countryFlag } = await import("../src/lib/v2/get-started");
    expect(countryFlag("United States")).toEqual({ flag: "🇺🇸", name: "United States" });
    expect(countryFlag("Germany")?.flag).toBe("🇩🇪");
    expect(countryFlag("United Kingdom")?.flag).toBe("🇬🇧");
    expect(countryFlag("Bermuda")?.flag).toBe("🇧🇲");
    expect(countryFlag("Narnia")).toEqual({ flag: null, name: "Narnia" });
    expect(countryFlag(null)).toBeNull();
    expect(countryFlag(" ")).toBeNull();
    expect(PAGE).not.toContain(">Location</th>");
    expect(PAGE).not.toContain(">Size</th>");
    expect(PAGE).toContain("const country = countryFlag(r.company.country);");
  });
});

import { legCatalogueFromWire } from "../src/lib/legs";
describe("step descriptions and the instant audience size", () => {
  it("reads features-service's shortDescription onto each step", () => {
    const c = legCatalogueFromWire({ steps: [{ key: "purchase", label: "Direct purchase", shortDescription: "Buys online, no sales call" }, { key: "signup", label: "Signup" }] });
    expect(c.steps.get("purchase")?.description).toBe("Buys online, no sales call");
    expect(c.steps.get("signup")?.description).toBeUndefined();
  });

  it("shows human-service's instant estimate on each audience card, the measured count only as a fallback", () => {
    expect(PAGE).toContain("<AudienceSize count={a.estimatedLeadCount ?? counts[a.name]}");
    const api = read("src/lib/api.ts");
    expect(api).toContain("estimatedLeadCount: z.number().nullish(),");
  });
});
