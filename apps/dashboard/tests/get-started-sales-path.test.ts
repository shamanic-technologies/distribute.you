import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  REPLY_MARGIN_SHARE,
  firstLaunchedPath,
  launchPlan,
  initialSalesSteps,
  parseDraftedSteps,
  planFloorUsd,
  replyCeilingUsd,
  replyMarginUsd,
  salesStepsDraftField,
  type PlanPath,
} from "../src/lib/v2/get-started";
import { selectionFromSteps, type PathLeg } from "../src/lib/offer-sales-path";
import { parseOfferSalesPaths } from "../src/lib/offer-sales-paths";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const PAGE = read("src/components/v2/get-started/get-started.tsx");
const LAUNCH = read("src/components/v2/get-started/launch.ts");
const WALL = read("src/components/v2/get-started/account-card-wall.tsx");
const KEEL = read("src/components/v2/keel.css");
const PATHS = read("src/components/v2/offer-sales-paths.tsx");

const leg = (legKey: string, from: string | null, slug: string | null) => ({
  legKey,
  fromStep: from ? { key: from } : null,
  toStep: { label: legKey.split("_to_")[1] },
  workedBy: slug ? "platform" : "human",
  channel: slug ? { slug, name: null } : null,
});

// Two paths as features-service ranks them: a reply path through meeting booking first,
// a visit path second, and a path entered by nothing we run (it buys nothing).
const PATHS_FIXTURE: PlanPath[] = [
  {
    pathKey: "human-entry",
    entryChannelSlug: null,
    legs: [leg("start_to_meeting_booked", null, null), leg("meeting_booked_to_paid_client", "meeting_booked", null)],
  },
  {
    pathKey: "reply",
    entryChannelSlug: "sales-cold-email-outreach",
    legs: [
      leg("start_to_conversation", null, "sales-cold-email-outreach"),
      leg("conversation_to_meeting_booked", "conversation", "ai-meeting-booking"),
      leg("meeting_booked_to_paid_client", "meeting_booked", null),
    ],
  },
  {
    pathKey: "visit",
    entryChannelSlug: "sales-cold-email-outreach",
    legs: [leg("start_to_website_visit", null, "sales-cold-email-outreach"), leg("website_visit_to_paid_client", "website_visit", null)],
  },
];

describe("the steps are drafted off the site, from the catalogue only", () => {
  it("asks for keys from the list it names, never the positive reply (no site shows it)", () => {
    const f = salesStepsDraftField([
      { key: "conversation", label: "Positive reply" },
      { key: "website_visit", label: "Website visit" },
      { key: "meeting_booked", label: "Meeting booked" },
    ]);
    expect(f.key).toBe("salesSteps");
    expect(f.description).toContain("website_visit (Website visit), meeting_booked (Meeting booked).");
    expect(f.description).not.toContain("conversation (Positive reply)");
  });

  it("always opens with the positive reply ticked, whatever the draft said", () => {
    const offered = ["conversation", "website_visit", "meeting_booked", "meeting_attended", "signup"];
    // Legistai 2026-10-03: the site read drafted website-visit steps only.
    expect(initialSalesSteps(["website_visit", "meeting_booked", "meeting_attended", "signup"], offered)).toEqual(offered);
    // A failed or empty draft still ticks it.
    expect(initialSalesSteps([], offered)).toEqual(["conversation"]);
    expect(initialSalesSteps(null, offered)).toEqual(["conversation"]);
    // Said by the model too: once, in catalogue order.
    expect(initialSalesSteps("meeting_booked\nconversation", offered)).toEqual(["conversation", "meeting_booked"]);
  });

  it("the positive reply ticked beside a meeting ticks the reply-to-meeting leg", () => {
    const legs: PathLeg[] = [
      { legKey: "start_to_conversation", fromKey: null, toKey: "conversation" },
      { legKey: "conversation_to_meeting_booked", fromKey: "conversation", toKey: "meeting_booked" },
      { legKey: "start_to_website_visit", fromKey: null, toKey: "website_visit" },
      { legKey: "website_visit_to_meeting_booked", fromKey: "website_visit", toKey: "meeting_booked" },
    ];
    const sel = selectionFromSteps(initialSalesSteps(["website_visit", "meeting_booked"], ["conversation", "website_visit", "meeting_booked"]), legs);
    expect(sel.legs.has("start_to_conversation")).toBe(true);
    expect(sel.legs.has("conversation_to_meeting_booked")).toBe(true);
  });

  it("keeps only offered steps, in catalogue order, however the model wrote them", () => {
    const offered = ["website_visit", "conversation", "meeting_booked"];
    expect(parseDraftedSteps("- meeting_booked (Meeting booked)\nconversation\ninvented_step", offered)).toEqual(["conversation", "meeting_booked"]);
    expect(parseDraftedSteps(["website_visit"], offered)).toEqual(["website_visit"]);
    expect(parseDraftedSteps(null, offered)).toEqual([]);
  });

  it("ticking the drafted steps ticks the legs between them", () => {
    const legs: PathLeg[] = [
      { legKey: "start_to_conversation", fromKey: null, toKey: "conversation" },
      { legKey: "conversation_to_meeting_booked", fromKey: "conversation", toKey: "meeting_booked" },
      { legKey: "meeting_booked_to_paid_client", fromKey: "meeting_booked", toKey: "paid_client" },
    ];
    const sel = selectionFromSteps(["conversation", "meeting_booked"], legs);
    expect([...sel.legs].sort()).toEqual(["conversation_to_meeting_booked", "meeting_booked_to_paid_client", "start_to_conversation"]);
  });
});

describe("what we launch", () => {
  it("frames the best path a channel of ours enters, never one entered by nothing we run", () => {
    expect(firstLaunchedPath(PATHS_FIXTURE)?.pathKey).toBe("reply");
  });

  it("creates every leg a channel of ours works, the framed path first, once each", () => {
    expect(launchPlan(PATHS_FIXTURE)).toEqual([
      { featureSlug: "sales-cold-email-outreach", legKey: "start_to_conversation", label: "Cold email", outcome: "conversation", reactive: false, required: true },
      { featureSlug: "ai-meeting-booking", legKey: "conversation_to_meeting_booked", label: "Meeting booking", outcome: "meeting_booked", reactive: true, required: true },
      { featureSlug: "sales-cold-email-outreach", legKey: "start_to_website_visit", label: "Cold email", outcome: "website_visit", reactive: false, required: false },
    ]);
  });

  // Prod 2026-10-02: a visit path and a reply path both entered by cold email named both
  // campaigns "<offer> (Cold email)", and campaign-service refused the second (409, name
  // taken), so every launch with two paths stopped on the wall.
  it("names every campaign of the plan apart, even one channel on two legs", () => {
    const plan = launchPlan(PATHS_FIXTURE);
    const names = plan.map((c) => `${c.outcome}, ${c.label}`);
    expect(new Set(names).size).toBe(plan.length);
    expect(LAUNCH).toContain("name: `${offerName} (${c.outcome}, ${c.label})`");
  });

  it("reads the production body through the real parser", () => {
    const data = parseOfferSalesPaths(JSON.parse(read("tests/fixtures/offer-sales-paths.prod.json")), "test");
    expect(launchPlan(data.paths)).toEqual([
      { featureSlug: "sales-cold-email-outreach", legKey: "start_to_website_visit", label: "Cold email", outcome: "Website visit", reactive: false, required: true },
    ]);
  });
});

describe("the reply margin, Google Ads' way", () => {
  it("is half the budget, shared between the reply campaigns, whole dollars", () => {
    expect(REPLY_MARGIN_SHARE).toBe(0.5);
    expect(replyMarginUsd(20)).toBe(10);
    expect(replyCeilingUsd(20, 1)).toBe(10);
    expect(replyCeilingUsd(20, 2)).toBe(5);
    expect(replyCeilingUsd(20, 0)).toBe(0);
  });

  it("lifts the smallest budget so every campaign clears its channel's floor", () => {
    const plan = launchPlan(PATHS_FIXTURE);
    const floors = new Map([
      ["sales-cold-email-outreach", 100],
      ["ai-meeting-booking", 300],
    ]);
    // The meeting booking needs $3 out of a 50% margin: a $6 budget.
    expect(planFloorUsd(plan, floors, 1)).toBe(6);
    expect(planFloorUsd(plan.filter((c) => !c.reactive), floors, 1)).toBe(1);
  });
});

describe("the call sites", () => {
  it("states the ONE daily budget as the brand's global budget before creating the campaigns", () => {
    const at = LAUNCH.indexOf("await setBrandSalesBudget(input.brandId, input.budgetUsd * 100)");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(LAUNCH.indexOf("createCampaignWithoutBrandEnrichment({"));
    expect(LAUNCH).toContain("c.reactive ? replyCeilingUsd(input.budgetUsd, replies) : input.budgetUsd");
  });

  it("asks the reply margin as a required box, unticked by default, on the payment wall", () => {
    // Unticked for pay-as-you-go; a plan's budget is fixed, so there is nothing to tick.
    expect(WALL).toContain("const [marginOk, setMarginOk] = useState(subscription);");
    expect(WALL).toContain("if (hasReplies && !marginOk) {");
    expect(WALL).toContain("up to +50% of my daily budget");
    expect(WALL).not.toContain("a day on each");
  });

  it("frames the path launched first and lets a rate be overwritten from its detail", () => {
    expect(PAGE).toContain("highlightPathKey={firstPath?.pathKey ?? null}");
    expect(PAGE).toContain("await stateBrandLegRates(brandId, [{ fromStep: leg.fromStep.label, toStep: leg.toStep.label, ratePct }]);");
    expect(PATHS).toContain("onStateRate ? <RateEditor leg={leg} onStateRate={onStateRate} />");
  });

  it("prices the wall's floor on every channel of the plan", () => {
    expect(PAGE).toContain("floorUsd={planFloorUsd(plan, floorCents, floorUsd)}");
    expect(PAGE).toContain("plan={plan}");
  });

  it("asks nothing about visits or meetings any more", () => {
    expect(PAGE).not.toContain("OutcomeStage");
    expect(PAGE).not.toContain("outcome-prices");
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

  it("writes the emails only once the give lists are SAVED, and ranks paths only off SAVED legs", () => {
    const gives = PAGE.slice(PAGE.indexOf("async function confirmGives("), PAGE.indexOf("\n  }\n", PAGE.indexOf("async function confirmGives(")));
    expect(gives.indexOf("await saveOfferUserFields")).toBeLessThan(gives.indexOf("setAnswered(true)"));
    expect(PAGE).toContain("if (brandId && offer && legsSaved && !salesPaths && pathsState === \"idle\") void loadPaths();");
  });

  it("draws a grey Back on every step but the first", () => {
    expect(PAGE).toContain("previousStep(stagedKey) ? () => goBack(stagedKey) : null");
  });

  it("says nothing on a step waiting for a pick", () => {
    expect(PAGE).not.toContain("Your pick");
    expect(PAGE).not.toContain("We ticked what we read on your site");
  });

  it("shows each audience's market size, big, from human-service's count", () => {
    expect(PAGE).toContain("<AudienceSize count={a.estimatedLeadCount ?? counts[a.name]}");
    expect(PAGE).toContain("if (row && row.apolloCount != null) counts[name] = row.apolloCount;");
  });

  it("names the multiple as ROI, and lets the lifetime revenue be changed from a path's detail", () => {
    expect(PATHS).toContain("`${formatRoi(path.roi)} ROI`");
    expect(PATHS).toContain("<LifetimeRevenueEditor value={path.lifetimeRevenueUsd} onSave={onStateLifetimeRevenue} />");
    expect(PAGE).toContain("onStateLifetimeRevenue={stateLifetimeRevenue}");
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
    expect(previousStep("legs")).toBe("salesSteps");
  });
});

describe("the payment wall, simplified", () => {
  it("never closes on a click outside the panels (only × or Escape)", () => {
    expect(WALL).not.toContain("if (e.target === e.currentTarget && !busy && stage !== \"launching\") onClose();");
  });

  it("freezes the walk behind an open wall", () => {
    expect(PAGE).toContain("if (wallOpen) return;\n    const mv = stageMove(phases, stageIdx);");
  });

  it("asks Google OR email, with the email field right above its button, and asks the budget with the card", () => {
    const form = WALL.slice(WALL.indexOf('{stage === "account" ? ('), WALL.indexOf("</form>", WALL.indexOf('{stage === "account" ? (')));
    expect(form.indexOf("Continue with Google")).toBeLessThan(form.indexOf("Continue with Email"));
    expect(form.indexOf('placeholder="you@company.com"')).toBeLessThan(form.indexOf("copy.emailCta}"));
    expect(form).not.toContain("{budgetRow}");
    expect(WALL).toContain('if (!checkReady("account")) return;');
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
    expect(PAGE).toContain('"Email found and verified"');
  });
});

describe("batch: wall, urgency, Back in the card, purchase rule", () => {
  it("tells the step draft that a purchase is an online checkout, never a payment after signup", () => {
    expect(salesStepsDraftField([{ key: "purchase", label: "Direct purchase" }]).description).toContain("a payment after a signup, a trial or a call is NOT a purchase");
  });

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
  it("titles the paths step with the gain and headlines rows by return", () => {
    expect(PAGE).toContain('title="Your most profitable opportunity"');
    expect(PAGE).not.toContain("Where your money goes");
    expect(PAGE).toContain("gainHeadline");
    expect(PATHS).toContain("per client won");
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

  it("draws the description under each step card, and feeds it to the step draft", () => {
    const picker = read("src/components/v2/offer-sales-path.tsx");
    expect(picker).toContain("catalogue.steps.get(s)?.description");
    expect(PAGE).toContain("st?.description ? `${st.label}: ${st.description}`");
  });

  it("shows human-service's instant estimate on each audience card, the measured count only as a fallback", () => {
    expect(PAGE).toContain("<AudienceSize count={a.estimatedLeadCount ?? counts[a.name]}");
    const api = read("src/lib/api.ts");
    expect(api).toContain("estimatedLeadCount: z.number().nullish(),");
  });
});
