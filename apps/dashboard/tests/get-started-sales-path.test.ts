import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  DEFAULT_SIGNUP_DRAFT,
  briefToLaunch,
  capPeriodOf,
  estimatedLine,
  isLearning,
  isMeetingCampaignFunnel,
  parseSignupDraft,
  parseSignupFunnel,
  signupCampaignFunnelFrom,
  signupLaunchPlan,
} from "../src/lib/v2/signup-campaign";
import { budgetRangeText, oneCampaignPlan, parseVolumeEstimate, timingText, type VolumeEstimate } from "../src/lib/v2/campaign-volume";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const PAGE = read("src/components/v2/get-started/get-started.tsx");
const LAUNCH = read("src/components/v2/get-started/launch.ts");
const WALL = read("src/components/v2/get-started/account-card-wall.tsx");
const KEEL = read("src/components/v2/keel.css");

// The END of signup (owner 2026-11-22, ONE-CAMPAIGN-VOLUME-1122): ONE campaign aimed at meetings booked, a volume,
// its served budget range and cap, then the wall.
const row = (o: Record<string, unknown>) => ({ face: "/f.svg", line: "x", costUsd: null, costPer: null, roi: null, runnable: true, mixed: false, ...o });
const MEET =
  "start_to_lead_found@lead-sourcing+lead_found_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked@ai-meeting-booking+meeting_booked_to_meeting_attended+meeting_attended_to_paid_client";
const COLD = "start_to_lead_found@lead-sourcing+lead_found_to_conversation@sales-cold-email-outreach+conversation_to_paid_client";
const CRM = "start_to_lead_found@sourcing-crm-contacts~warm-never-converted+lead_found_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked@ai-meeting-booking";
const PAGE_ROWS = {
  rows: [
    row({ id: COLD, name: "Epiphany", type: "proactive", roi: 17 }),
    row({ id: CRM, name: "Warm", type: "proactive", roi: 9 }),
    row({ id: MEET, name: "Motivate", type: "proactive", costUsd: 263, costPer: "per meeting booked", roi: 4, status: "estimated", mixed: true }),
  ],
};
const ESTIMATE = (volume: number, period: string, over: Partial<VolumeEstimate> = {}): VolumeEstimate =>
  parseVolumeEstimate({
    offerId: "o",
    brandId: "b",
    salesFunnelIds: [MEET],
    target: { step: "meeting_booked", label: "Meetings booked" },
    basis: "fleet",
    isExpected: true,
    unavailableReason: null,
    perUnit: { lowUsd: 152.3, highUsd: 492.2, medianUsd: 263 },
    volume: { volume, period },
    budget: { period, lowUsd: 1523, highUsd: 4922, maxUsd: 4922, unavailableReason: null },
    timing: { firstUnitsWeek: 1, steadyFromWeek: 10, steadyPerPeriod: volume, weeks: [], unavailableReason: null },
    ...over,
  });

describe("Your campaign: ONE funnel that runs the whole campaign, picked as served", () => {
  it("takes the first runnable funnel that books the meeting after the cold email (served mixed or not)", () => {
    expect(signupCampaignFunnelFrom(PAGE_ROWS)).toMatchObject({ salesFunnelId: MEET, name: "Motivate", status: "estimated" });
    expect(signupCampaignFunnelFrom({ rows: [] })).toBeNull();
    expect(signupCampaignFunnelFrom({ rows: [row({ id: MEET, name: "M", type: "proactive", runnable: false })] })).toBeNull();
    expect(() => signupCampaignFunnelFrom({ nope: [] })).toThrow();
    // One narrowed page: every word of q must appear, so the meeting funnel is never off a 25-row page.
    const api = read("src/lib/api.ts");
    expect(api).toContain('"start_to_lead_found@lead-sourcing",\n    "lead_found_to_conversation@sales-cold-email-outreach",\n    "conversation_to_meeting_booked@ai-meeting-booking",');
    expect(api).toContain("&containsChannels=ai-meeting-booking&runnable=true&limit=25&target=${encodeURIComponent(target)}&q=${encodeURIComponent(q)}");
  });

  it("only Lead Sourcing -> cold email -> AI meeting booking; never the client's own contacts nor a re-serve play", () => {
    expect(isMeetingCampaignFunnel(MEET)).toBe(true);
    expect(isMeetingCampaignFunnel(MEET.replace("@lead-sourcing+", "@lead-sourcing~valid-catch-all+"))).toBe(true);
    expect(isMeetingCampaignFunnel(COLD)).toBe(false);
    expect(isMeetingCampaignFunnel(CRM)).toBe(false);
    expect(isMeetingCampaignFunnel(MEET.replace("@lead-sourcing+", "@lead-sourcing~contacted-pure-prospects+"))).toBe(false);
    // A snapshot from the two-card step (no meeting funnel) is not reopened: the step reads again.
    expect(parseSignupFunnel({ salesFunnelId: COLD, name: "Epiphany" })).toBeNull();
    expect(parseSignupFunnel(JSON.parse(JSON.stringify(signupCampaignFunnelFrom(PAGE_ROWS))))).toEqual(signupCampaignFunnelFrom(PAGE_ROWS));
  });

  it("states the served cost with its unit, and nothing when none is served", () => {
    expect(estimatedLine({ costUsd: 143.48, costPer: "per paying client", roi: 4.25, status: "estimated" })).toBe("Estimated: $143 per paying client · 4.3x return");
    expect(estimatedLine({ costUsd: null, costPer: null, roi: null, status: "estimated" })).toBeNull();
    expect(estimatedLine({ costUsd: 9, costPer: "per meeting booked", roi: 3, status: "learning" })).toBeNull();
    expect(isLearning({ status: "learning" })).toBe(true);
  });

  it("opens on 5 interested leads a week, the brief untouched (owner 2026-11-23)", () => {
    expect(DEFAULT_SIGNUP_DRAFT).toEqual({ volume: "5", volumePeriod: "week", brief: null, monthlyLimit: null });
    // An older two-card snapshot keeps only the monthly limit.
    expect(parseSignupDraft({ budget: "35", proactiveOn: false, monthlyLimit: "500" })).toEqual({ ...DEFAULT_SIGNUP_DRAFT, monthlyLimit: "500" });
    expect(parseSignupDraft({ volume: "4", volumePeriod: "month", brief: "kept" })).toEqual({ volume: "4", volumePeriod: "month", brief: "kept", monthlyLimit: null });
  });

  it("launches ONE campaign: the brief (edit over prefill), the volume, and the cap = the top of the served range", () => {
    const funnel = signupCampaignFunnelFrom(PAGE_ROWS);
    const TEN = { ...DEFAULT_SIGNUP_DRAFT, volume: "10" };
    const r = signupLaunchPlan({ draft: TEN, funnel, briefPrefill: "Book HR leaders.", estimate: ESTIMATE(10, "week") });
    expect(r).toEqual({
      plan: { salesFunnelIds: [MEET], salesFunnelId: MEET, name: "Motivate", target: "meeting_booked", brief: "Book HR leaders.", volume: 10, period: "week", maxBudgetCents: 492200 },
    });
    const edited = signupLaunchPlan({ draft: { ...TEN, brief: "  Mine.  " }, funnel, briefPrefill: "x", estimate: ESTIMATE(10, "week") });
    expect("plan" in edited && edited.plan.brief).toBe("Mine.");
    expect(capPeriodOf("day")).toBe("daily");
    expect(capPeriodOf("week")).toBe("weekly");
    expect(capPeriodOf("month")).toBe("monthly");
  });

  it("refuses: no brief, a broken volume, an estimate read for another volume, an unpriced one, no funnel", () => {
    const funnel = signupCampaignFunnelFrom(PAGE_ROWS);
    const base = { draft: { ...DEFAULT_SIGNUP_DRAFT, volume: "10" }, funnel, briefPrefill: "b", estimate: ESTIMATE(10, "week") };
    expect(signupLaunchPlan({ ...base, briefPrefill: null })).toEqual({ problem: "Say in a few words what your campaign should do." });
    expect(signupLaunchPlan({ ...base, draft: { ...DEFAULT_SIGNUP_DRAFT, volume: "2.5" } })).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...base, draft: { ...DEFAULT_SIGNUP_DRAFT, volume: "0" } })).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...base, estimate: ESTIMATE(12, "week") })).toEqual({ problem: "One moment, we are pricing that volume." });
    expect(signupLaunchPlan({ ...base, estimate: ESTIMATE(10, "month") })).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...base, estimate: ESTIMATE(10, "week", { budget: null }) })).toHaveProperty("problem");
    expect(signupLaunchPlan({ ...base, funnel: null })).toHaveProperty("problem");
    expect(oneCampaignPlan({ salesFunnelIds: [], brief: "b", volume: "1", period: "week", estimate: null })).toHaveProperty("problem");
    expect(briefToLaunch(null, "  served ")).toBe("served");
  });

  it("words the served figures without computing one", () => {
    const e = ESTIMATE(10, "week");
    expect(budgetRangeText(e)).toBe("$1,523 to $4,922");
    expect(timingText(e, 10, "week")).toBe("First meetings booked around week 1, then about 10 a week from week 10.");
    // The pricing outcome (a positive reply) reads in the owner's word (2026-11-23).
    const interested = { ...e, target: { step: "conversation", label: "Positive reply" } };
    expect(timingText(interested, 5, "week")).toBe("First interested leads around week 1, then about 5 a week from week 10.");
    expect(timingText(ESTIMATE(10, "week", { timing: { firstUnitsWeek: 3, steadyFromWeek: null, unavailableReason: null } }), 10, "week")).toBe("First meetings booked around week 3.");
    expect(timingText(ESTIMATE(10, "week", { timing: null }), 10, "week")).toBeNull();
    expect(budgetRangeText(ESTIMATE(10, "week", { budget: null }))).toBeNull();
  });

  it("reads the funnels, the brief and the estimate for THIS offer, signed out on the anonymous session, and keeps them for the wall", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain("/offers/${encodeURIComponent(offerId)}/sales-funnels?brandId=${encodeURIComponent(brandId)}");
    expect(api).toContain("/offers/${encodeURIComponent(offerId)}/target-volume-estimate?");
    expect(PAGE).toContain("saveSnapshot({ funnel: next });");
    expect(PAGE).toContain("saveSnapshot({ briefPrefill: next });");
    expect(PAGE).toContain("saveSnapshot({ estimate: next });");
    expect(PAGE).toContain("if (s.estimate) setEstimate(s.estimate);");
    // The estimate prices interested leads; the brief and the funnels keep the campaign's Target (owner 2026-11-23).
    expect(PAGE).toContain("target: PRICING_TARGET,\n        volume: wantedVolume,");
    expect(PAGE).toContain("target: SIGNUP_TARGET });");
    const allow = read("src/lib/anon-proxy-allowlist.ts");
    expect(allow).toContain('segments: ["offers", ":seg", "target-volume-estimate"], queryBrand: "brandId"');
  });
});

describe("what we launch: ONE campaign, its caps on it (owner 2026-11-22)", () => {
  it("one create carrying Target, brief and max budget, never the pricing volume as a cap; no funnel-wide caps, no second campaign", () => {
    const fn = LAUNCH.slice(LAUNCH.indexOf("async function launchCampaign("), LAUNCH.indexOf("export async function launchFromPreview("));
    // The volume typed is interested leads that only price the campaign (owner 2026-11-23).
    expect(fn).not.toContain("maxVolume:");
    expect(fn).toContain("maxBudget: { amountCents: plan.maxBudgetCents, period }");
    expect(fn).toContain("target: plan.target");
    expect(LAUNCH).not.toContain("saveSalesFunnelCaps");
    expect(LAUNCH).not.toContain("plan.reactive");
    expect(LAUNCH.match(/startSalesFunnelCampaign\(/g)?.length).toBe(1);
  });

  it("starts no pre-funnel campaign and writes no sales path, channel or per-piece budget", () => {
    for (const gone of ["createCampaignWithoutBrandEnrichment", "startReactiveCampaign", "saveOfferCampaignBudget", "saveOfferSalesPath", "saveOfferChannels", "saveOfferSelectedSalesPaths"]) {
      expect(LAUNCH, gone).not.toContain(gone);
      expect(PAGE, gone).not.toContain(gone);
    }
  });

  it("the page opens the step from the email step, checks the plan, then opens the wall", () => {
    expect(PAGE).toContain("Set up my campaign");
    const confirm = PAGE.slice(PAGE.indexOf("function confirmCampaign("), PAGE.indexOf("/** Step 6: what one client is worth"));
    expect(confirm.indexOf("signupLaunchPlan(")).toBeLessThan(confirm.indexOf("setWallOpen(true)"));
    expect(PAGE).toContain("plan={launchPlan}");
  });

  it("speaks no funnel, pipe, leg or sales path words, states a volume (never a daily spend), the outcome as served", () => {
    const stage = PAGE.slice(PAGE.indexOf("function CampaignStage("), PAGE.indexOf("/** Step 6: what one client brings"));
    const words = stage.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const shown = [...(words.match(/"[^"\n]*"/g) ?? []), ...(words.match(/>[^<>{}\n]+</g) ?? [])].join("\n");
    expect(shown).not.toMatch(/funnel|pipe|\bleg\b|sales path/i);
    expect(stage).toContain('title="Your campaign"');
    for (const label of ["What it does", "How many you want", "Estimated budget", "per month, all campaigns together"]) expect(stage, label).toContain(label);
    // The outcome is the served label, never a word typed here.
    expect(stage).toContain("targetLabel(estimate).toLowerCase()");
    expect(stage).not.toMatch(/>\s*meetings booked\s*</);
    expect(stage).not.toContain("Max budget in dollars");
    expect(stage).not.toContain("<CampaignChoice");
    expect(stage).toContain("<BriefText text={briefToLaunch(draft.brief, briefPrefill)}");
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

  it("shows each audience's market size, big, from human-service's real count", () => {
    expect(PAGE).toContain("<AudienceSize count={counts[a.name]} failed={!!countErrors[a.name]} />");
    expect(PAGE).toContain("if (e.estimatedPeople != null) counts[e.name] = e.estimatedPeople;");
  });

  it("calls the emails step a preview", () => {
    // The words live per A/B arm (owner 2026-10-17): the email arm still says "Preview my emails".
    const arm = readFileSync(resolve(__dirname, "../src/lib/v2/get-started-arm.ts"), "utf8");
    expect(arm).toContain('givesButton: "Preview my leads"');
    expect(PAGE).toContain("GS_ARM_COPY[arm].givesButton");
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

  // SEGMENT-REAL-COUNT-1107 (owner 2026-11-07): the split's LLM guess read ~350 where
  // Apollo counted 31. Cards render at once, read "Counting…", then the REAL count, or
  // say the count failed; the guess is read nowhere.
  it("shows only the real count on each audience card: Counting… first, a visible failure, never the guess", () => {
    const api = read("src/lib/api.ts");
    const lib = read("src/lib/v2/get-started.ts");
    for (const src of [PAGE, api, lib]) expect(src).not.toContain(["estimated", "LeadCount"].join(""));
    expect(PAGE).toContain(">Counting…</span>");
    expect(PAGE).toContain(">Could not count</span>");
    expect(PAGE).toContain("for (const a of audienceProposals) if (!(a.name in counts)) failed[a.name] = true;");
  });
});

describe("no new campaign leaves the dashboard without a brief (HUMAN-BRIEF-1121, owner 2026-11-21)", () => {
  const api = readFileSync(resolve(__dirname, "../src/lib/api.ts"), "utf8");
  const start = api.slice(api.indexOf("export async function startSalesFunnelCampaign("), api.indexOf("export async function getCampaignBriefPrefill("));
  it("the one create call requires a brief, refuses an empty one, and sends it", () => {
    expect(start).toContain("    brief: string;\n");
    expect(start).toContain('throw new Error("[startSalesFunnelCampaign] a new campaign needs a brief")');
    expect(start).toContain('status: input.held ? "stopped" : "ongoing",\n      brief,');
  });
  it("the launch hands the campaign's brief to it, and the brief is read from features-service, never composed", () => {
    expect(LAUNCH).toContain("    brief: plan.brief,\n");
    expect(api).toContain("/offers/${encodeURIComponent(offerId)}/campaign-brief?");
  });
  it("only api.ts POSTs a new funnel campaign", () => {
    const { execSync } = require("child_process") as typeof import("child_process");
    const hits = execSync(`grep -rl "sales-funnel-campaigns\\\`, {" ${resolve(__dirname, "../src")} || true`, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    expect(hits.map((h) => h.replace(/.*\/src\//, "src/"))).toEqual(["src/lib/api.ts"]);
  });
});
