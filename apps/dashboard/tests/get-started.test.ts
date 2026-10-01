import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  EMAIL_CAP,
  GET_STARTED_STEPS,
  PREWRITTEN_EMAILS,
  STEPS_NOT_LIVE,
  canWriteAnother,
  compactCount,
  employeesLabel,
  hostOf,
  hotLeadsForCredit,
  nextSlide,
  offerSourceText,
  parseCompetitors,
  parseDailyBudget,
  parseGetStartedSnapshot,
  sizeDots,
  stageDwellMs,
  stageMove,
  valueLines,
} from "../src/lib/v2/get-started";

/**
 * Onboarding v2 (`/get-started`). `lib/v2/get-started.ts` is alias-free, so the
 * first half is real unit tests; the second half pins the surface.
 */

describe("the rules the page decides on", () => {
  it("reads competitors with their domains, dropping duplicates and the brand itself", () => {
    const got = parseCompetitors(
      ["Calendly (calendly.com)", "SavvyCal (https://www.savvycal.com)", "calendly.com", "TidyCal (tidycal.com)", "Doodle"],
      "tidycal.com",
    );
    expect(got).toEqual([
      { name: "Calendly", domain: "calendly.com" },
      { name: "SavvyCal", domain: "savvycal.com" },
      { name: "Doodle", domain: null },
    ]);
  });

  it("reads a competitor list however the model shaped it", () => {
    expect(parseCompetitors("- Acme (acme.io)\n- Beta (beta.com)", null).map((c) => c.domain)).toEqual(["acme.io", "beta.com"]);
    expect(parseCompetitors([{ name: "Gamma", domain: "gamma.app" }], null)).toEqual([{ name: "Gamma", domain: "gamma.app" }]);
  });

  it("drops the model's Unknown rather than printing it", () => {
    expect(valueLines("Unknown")).toEqual([]);
  });

  it("prints a segment size the way Explee does", () => {
    expect(compactCount(840)).toBe("840");
    expect(compactCount(12_400)).toBe("12.4K");
    expect(compactCount(3_100_000)).toBe("3.1M");
  });

  it("takes the host of whatever was typed", () => {
    expect(hostOf("https://www.Acme.com/pricing")).toBe("acme.com");
    expect(hostOf("acme.com")).toBe("acme.com");
    expect(hostOf("")).toBeNull();
  });

  it("refuses a budget under the channel floor or not in whole dollars", () => {
    expect(parseDailyBudget("", 1)).toEqual({ problem: "Enter a daily budget." });
    expect(parseDailyBudget("2.5", 1)).toEqual({ problem: "Enter a whole number of dollars a day." });
    expect(parseDailyBudget("3", 5)).toEqual({ problem: "Cold email runs from $5 a day." });
    expect(parseDailyBudget("$12", 1)).toEqual({ usd: 12 });
  });

  it("restores a snapshot, and starts over on anything malformed or older", () => {
    const snap = {
      version: 2,
      website: "https://acme.com",
      brandId: "b1",
      brandName: "Acme",
      domain: "acme.com",
      overview: "Acme sells anvils.",
      facts: ["Sells anvils"],
      competitors: [{ name: "Beta", domain: "beta.com" }],
      offer: { offerId: "o1", name: "Anvils", description: "Heavy anvils" },
      audience: { audienceId: "a1", name: "Coyotes", description: "Desert hunters" },
      budgetUsd: 10,
      email: null,
    };
    // The answers to steps 5 to 8 are absent on an older snapshot and read as not given.
    expect(parseGetStartedSnapshot(JSON.stringify(snap))).toEqual({ ...snap, outcome: null, lifetimeRevenueUsd: null, answered: false });
    expect(parseGetStartedSnapshot("{nope")).toBeNull();
    // A snapshot from before the offer and audience steps starts over.
    expect(parseGetStartedSnapshot(JSON.stringify({ ...snap, version: 1 }))).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify({ ...snap, budgetUsd: 2.5 }))?.budgetUsd).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify({ ...snap, offer: { name: "x" } }))?.offer).toBeNull();
  });

  it("asks for ONE offer and ONE audience, the offer questions, then 100 companies and the emails", () => {
    expect(GET_STARTED_STEPS.map((s) => s.key)).toEqual([
      "company",
      "competitors",
      "offer",
      "audience",
      "outcome",
      "value",
      "levers",
      "gives",
      "companies",
      "email",
    ]);
  });

  it("splits offers from the offer lines, else the overview", () => {
    expect(offerSourceText([" Self-serve plan ", "", "Enterprise, sold by call"], "Overview")).toBe("Self-serve plan\nEnterprise, sold by call");
    expect(offerSourceText([], " Acme sells anvils. ")).toBe("Acme sells anvils.");
    expect(offerSourceText([], "")).toBe("");
  });

  it("writes the first emails ahead and caps the free ones", () => {
    expect(PREWRITTEN_EMAILS).toBe(3);
    expect(EMAIL_CAP).toBe(10);
    expect(canWriteAnother(9)).toBe(true);
    expect(canWriteAnother(10)).toBe(false);
  });

  it("states a company's size as served, never a guess", () => {
    expect(employeesLabel(27)).toBe("27");
    expect(employeesLabel(1200)).toBe("1.2K");
    expect(employeesLabel(null)).toBeNull();
    expect(employeesLabel(0)).toBeNull();
    expect([1, 10, 50, 250, 1000].map(sizeDots)).toEqual([1, 2, 3, 4, 5]);
    expect(sizeDots(null)).toBe(0);
  });

  it("holds a finished step while the next one is still prepared, and not otherwise", () => {
    expect(stageDwellMs("running", 1600, 12000)).toBe(12000);
    expect(stageDwellMs("choose", 1600, 12000)).toBe(1600);
    expect(stageDwellMs("done", 1600, 12000)).toBe(1600);
  });

  it("walks the stage: holds a running step, hands a finished one on, jumps back to a re-run", () => {
    // Running on screen: hold.
    expect(stageMove(["running", "running", "running", "waiting", "waiting", "waiting"], 0)).toBeNull();
    // Done, the next one has begun: move on after a dwell.
    expect(stageMove(["done", "done", "running", "waiting", "waiting", "waiting"], 0)).toEqual({ to: 1, dwell: true });
    // Done, but the next one has not begun: stay on the result.
    expect(stageMove(["done", "done", "done", "waiting", "waiting", "waiting"], 2)).toBeNull();
    // Another audience was picked, so step 5 runs again while 6 is on screen: jump back.
    expect(stageMove(["done", "done", "done", "done", "running", "running"], 5)).toEqual({ to: 4, dwell: false });
    // A pick on screen holds the stage: it is begun but not settled.
    expect(stageMove(["done", "done", "choose", "choose", "waiting", "waiting"], 2)).toBeNull();
    // The competitors hand over to a pick that is ready.
    expect(stageMove(["done", "done", "choose", "running", "waiting", "waiting"], 1)).toEqual({ to: 2, dwell: true });
    // The last step stays.
    expect(stageMove(["done", "done", "done", "done", "done", "done"], 5)).toBeNull();
  });

  it("has every step live now that both producers reached the gateway", () => {
    expect([...STEPS_NOT_LIVE]).toEqual([]);
  });
});

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const FLOW = read("src/components/v2/get-started/get-started.tsx");
const JOURNAL = read("src/components/v2/get-started/journal.tsx");
const VT = read("src/components/v2/get-started/view-transition.ts");
const WALL = read("src/components/v2/get-started/account-card-wall.tsx");
const LAUNCH = read("src/components/v2/get-started/launch.ts");

describe("the surface", () => {
  it("is public, exactly, so a signed-out founder reaches it", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain('"/get-started",');
    expect(proxy).not.toContain('"/get-started(.*)"');
  });

  it("runs every signed-out read on the anonymous session", () => {
    expect(FLOW).toContain("startAnonSession(");
    // The claim re-points the anonymous org at the account, as /onboarding/claim does.
    expect(WALL).toContain('fetch("/api/anon/claim"');
  });

  it("reads the real companies and the real emails, never an email address", () => {
    expect(FLOW).toContain("getAudienceCompanies(");
    expect(FLOW).toContain("previewColdEmail(");
    // Each email names the picked offer and audience.
    expect(FLOW).toContain("audience: aud.name");
    expect(FLOW).toContain("offerId: offer?.offerId");
    expect(FLOW).not.toMatch(/revealEmail|enrich\(|emailAddress/);
  });

  it("prepares the offer and the audience proposals in the background, in parallel, before the stage reaches them", () => {
    const start = FLOW.slice(FLOW.indexOf("async function start("), FLOW.indexOf("const canLaunch"));
    expect(start).toContain("...OFFER_FIELDS");
    // The ICP is drafted from what the read stored (an empty profile is refused), so the
    // audience read starts after the site read, in parallel with the offer split.
    expect(start.indexOf("await siteRead;")).toBeLessThan(start.indexOf("prepareAudiences(id)"));
    expect(start).toContain("await Promise.all([prepareOffers(id, offerSource.current.lines, offerSource.current.ov), prepareAudiences(id)])");
    expect(FLOW).toContain("proposeBrandOffers(");
    expect(FLOW).toContain("proposeAudienceSegments(");
  });

  it("confirms exactly the ONE offer and the ONE audience picked", () => {
    expect(FLOW).toContain("confirmBrandOffers(brandId, [picked], 0)");
    expect(FLOW).toContain("confirmAudienceSegments(brandId, offer.offerId, icpRef.current || seg.description, [seg])");
  });

  it("creates every proposed audience once the offer is picked, so their searches build while the visitor reads", () => {
    expect(FLOW).toContain("prebuild.current = confirmAudienceSegments(brandId, offerId, icpRef.current || segs[0].description, segs)");
    // A pick made while that confirm is in flight waits for it rather than creating the audience twice.
    const pick = FLOW.slice(FLOW.indexOf("async function pickAudience("), FLOW.indexOf("function chooseAudience("));
    expect(pick).toContain("await prebuild.current;");
    // The wait for the search to build is shown, and bounded.
    expect(FLOW).toContain('page.reason === "not_built_yet" && waits < 80');
    expect(FLOW).toContain("<BuildingNote building={building} />");
  });

  it("loads the 100 companies page by page and writes the first emails ahead, the rest on click, capped", () => {
    const load = FLOW.slice(FLOW.indexOf("async function loadCompanies("), FLOW.indexOf("// ── Step 6: the emails"));
    // A small first page (fast), the rest only as far as the visitor scrolls (each company costs a credit).
    expect(load).toContain("offset === 0 ? FIRST_PAGE : NEXT_PAGE");
    expect(load).toContain("while (offset < (wanted.current.get(id) ?? FIRST_PAGE))");
    expect(FLOW).toContain("<MoreSentinel onMore={onMore}");
    expect(load).toContain("offset = page.nextOffset");
    expect(load).toContain("prewrite(aud, got)");
    expect(FLOW).toContain(".slice(0, PREWRITTEN_EMAILS)");
    expect(FLOW).toContain("if (!canWriteAnother(requested.current.size)) return;");
    const open = FLOW.slice(FLOW.indexOf("function openRow("), FLOW.indexOf("// ── The stage"));
    expect(open).toContain("setWallOpen(true)");
  });

  it("checks one row's person live, one row at a time, and shows only a masked domain", () => {
    const q = FLOW.slice(FLOW.indexOf("function queueCheck("), FLOW.indexOf("function openRow("));
    expect(q).toContain("index >= 10");
    expect(q).toContain("checkQueue.current = checkQueue.current.then(");
    expect(q).toContain("checkAudienceCompanyEmail(audienceId, index)");
    const cell = FLOW.slice(FLOW.indexOf("function RowCheck("), FLOW.indexOf("function EmailsStage("));
    expect(cell).toContain("check.maskedEmail");
    expect(cell).toContain("motion-reduce:animate-none");
  });

  it("asks a timed-out email again, but never retries a refusal", () => {
    const body = FLOW.slice(FLOW.indexOf("async function writeWithRetry"), FLOW.indexOf("function sampleNote("));
    expect(body).toContain("e.status >= 400 && e.status < 500");
  });

  it("asks the account and the card on one screen", () => {
    expect(WALL).toContain("createEmbeddedCardSetup(");
    expect(WALL).toContain("signUp.create(");
    expect(WALL).toContain('id="clerk-captcha"');
  });

  it("speaks the v2 language, not v1's", () => {
    for (const src of [FLOW, WALL, JOURNAL]) {
      expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|InfoTooltip/);
    }
  });

  it("carries no em-dash in its copy", () => {
    for (const src of [FLOW, WALL, LAUNCH, JOURNAL]) {
      // The one dash allowed is Keel's missing-value marker, a `"\u2014"` literal.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/"\u2014"/g, "");
      expect(code).not.toContain("—");
    }
  });

  it("moves: steps rise in, lists cascade, counts count, the email types", () => {
    expect(FLOW).toContain("<Stepper");
    expect(FLOW).toContain("<LiveStatus");
    expect(FLOW).toContain("<CountUp value={rows.length}");
    expect(FLOW).toContain("<Typewriter text={mail.bodyText}");
    expect(FLOW).toMatch(/gs-pop[^"]*"[^>]*style=\{stagger\(i, 60\)\}/);
    expect(FLOW).toContain("gs-down sticky");
    expect(WALL).toContain("gs-panel k-popover");
    expect(WALL).toContain("gs-scrim");
  });

  it("shows the end state at once under reduced motion", () => {
    const css = read("src/components/v2/keel.css");
    const block = css.slice(css.indexOf("/get-started motion"));
    expect(block).toContain("prefers-reduced-motion: reduce");
    // A block pasted inside another comment silently disappears: every opener closes.
    expect(css.split("/*").length).toBe(css.split("*/").length);
    for (const cls of ["gs-in", "gs-pop", "gs-down", "gs-scrim", "gs-panel", "gs-glow"]) expect(block).toContain(`.v2-root .${cls}`);
    const motion = read("src/components/v2/get-started/motion.tsx");
    expect(motion).toContain("(prefers-reduced-motion: reduce)");
    // The typed email is readable in full from the first frame.
    expect(motion).toContain("aria-label={text}");
  });

  it("prices the budget on the picked offer, and launches that offer and that audience with the levers prefilled", () => {
    expect(LAUNCH).toContain("export async function recommendedBudgetForPreview(");
    expect(LAUNCH).toContain("recommendedDailyBudgetUsd(newOrgLeg(legKey)");
    expect(WALL).toContain("recommendedBudgetForPreview(brandId, offer.offerId, floorUsd, coldEmailLegFor(outcome))");
    expect(WALL).toContain("{ brandId, website, offer, audienceId: audience.audienceId, budgetUsd, outcome, answered }");
    // No re-pick at launch: the offer is the one confirmed at step 3.
    expect(LAUNCH).not.toContain("proposeBrandOffers");
    // The six levers are read off the site for that offer and saved on it.
    expect(LAUNCH).toContain('extractBrandFields([brandId], leverFields, { mode: "suggest", urlStrategy: "landing", offerId })');
    expect(LAUNCH).toContain("saveOfferUserFields(brandId, offerId, fields)");
    // The campaign's inputs are read after the levers land.
    expect(LAUNCH.indexOf("await levers;\n    const prefill")).toBeGreaterThan(0);
    // A default never blocks a price that lands later.
    expect(WALL).toContain("if (budgetTouched.current) onBudget(");
  });

  it("carries Explee's countdown and spots strips on the wall (owner-decided, copied for now)", () => {
    expect(WALL).toContain("<TrialTimer />");
    expect(WALL).toContain("<TrialSpots />");
  });

  it("counts Explee's clock down 7:30, then a 9:59 extension, then stops", async () => {
    const { timerPhase, spotsTakenThisHour } = await import("../src/components/v2/get-started/urgency");
    expect(timerPhase(0, 0)).toEqual({ phase: "initial", secondsLeft: 450 });
    expect(timerPhase(0, 450_000)).toEqual({ phase: "extended", secondsLeft: 599 });
    expect(timerPhase(0, 1_049_000)).toEqual({ phase: "expired", secondsLeft: 0 });
    const hour = 3_600_000 * 500_000;
    expect(spotsTakenThisHour(hour + 59 * 60_000)).toBeGreaterThanOrEqual(spotsTakenThisHour(hour));
  });

  it("is a journal and a stage: one step on screen, the finished ones in the rail", () => {
    expect(FLOW).toContain("<JournalRail {...journal} />");
    expect(FLOW).toContain("<JournalStrip {...journal} />");
    // The stage card and the rail entry share a transition name, so one flies into the other.
    expect(FLOW).toContain("viewTransitionName: stepViewName(stagedKey)");
    expect(JOURNAL).toContain("viewTransitionName: stepViewName(s.key)");
    // A rail entry is never drawn for the step on the stage (a duplicate name aborts the transition).
    expect(JOURNAL).toContain("d.staged !== key");
    expect(VT).toContain("prefers-reduced-motion: reduce");
    expect(VT).toContain("startViewTransition");
  });

  it("draws Explee's steps 7 to 9, dotted until the email is written", () => {
    expect(FLOW).toContain("NEXT_STEPS.map(");
    expect(FLOW).toContain('nextLit={steps.email === "done"}');
    expect(FLOW).toContain("border-dashed");
  });

  it("explains each sentence of the email on hover, focus and tap", () => {
    const body = FLOW.slice(FLOW.indexOf("function ExplainedBody("), FLOW.indexOf("function EmailBody("));
    expect(body).toContain('if (e.pointerType === "mouse") setActive(i)');
    expect(body).toContain("onClick={() => setActive(");
    expect(body).toContain("onFocus={() => setActive(i)}");
    expect(body).toContain("shown.reason");
    expect(FLOW).toContain("<EmailBody mail={mail} />");
  });

  it("leaves the current onboarding alone", () => {
    const onboarding = read("src/components/onboarding/onboarding.tsx");
    expect(onboarding).not.toContain("get-started");
  });
});

describe("the wall", () => {
  it("prices the $30 off a served median, or states nothing", () => {
    expect(hotLeadsForCredit(4.2)).toBe(7);
    expect(hotLeadsForCredit(40)).toBeNull();
    expect(hotLeadsForCredit(null)).toBeNull();
    expect(hotLeadsForCredit(0)).toBeNull();
    expect(hotLeadsForCredit(Number.NaN)).toBeNull();
  });

  it("turns the client carousel with a wrap", () => {
    expect(nextSlide(0, 3)).toBe(1);
    expect(nextSlide(2, 3)).toBe(0);
    expect(nextSlide(0, 0)).toBe(0);
  });

  it("keeps the written email across the Google round trip, and reads an older snapshot without one", () => {
    const base = { version: 2, website: "a.com", brandId: "b", brandName: null, domain: null, overview: "", facts: [], competitors: [], offer: null, audience: null, budgetUsd: null };
    expect(parseGetStartedSnapshot(JSON.stringify(base))?.email).toBeNull();
    const mail = { subject: "Hi", bodyText: "Body", recipient: { firstName: "Ann", lastName: "B.", title: "CEO", companyName: "Acme" } };
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, email: mail }))?.email).toEqual(mail);
  });

  it("opens over the blurred results, with the email sharp and the proof real", () => {
    const wall = fs.readFileSync(path.resolve(__dirname, "../src/components/v2/get-started/account-card-wall.tsx"), "utf8");
    expect(wall).toContain("backdrop-blur-");
    expect(wall).toContain("<EmailCard mail={writtenEmail} />");
    // Only named, consenting clients: the same selection the homepage proof uses.
    expect(wall).toContain("proofCardsFor(proof.showcase)");
    // The $30 figure is the served median divided, or absent.
    expect(wall).toContain("hotLeadsForCredit(proof?.hotLeads?.medianCostUsd)");
    // Email code, no password to type.
    expect(wall).not.toContain('type="password"');
    expect(wall).toContain('strategy: "email_code"');
    // The card form opens by itself once the account exists.
    expect(wall).toContain("cardOpened.current = true;");
    // The stage's view transitions stand down while the wall is up: their snapshots
    // paint in the top layer, above the wall.
    expect(wall).toContain("document.documentElement.classList.add(WALL_OPEN_CLASS)");
    const vt = fs.readFileSync(path.resolve(__dirname, "../src/components/v2/get-started/view-transition.ts"), "utf8");
    expect(vt).toContain("classList.contains(WALL_OPEN_CLASS)");
    // The claim has its own flag, so the code form's finally cannot clear it.
    expect(wall).toContain("setClaiming(true)");
    const flow = fs.readFileSync(path.resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(flow).toContain("email={(selectedKey ? emails[selectedKey] : undefined) ?? firstWritten(emails, audience.audienceId) ?? restoredEmail}");
  });

  it("lets a code-made account sign in again with a code", () => {
    const signIn = fs.readFileSync(path.resolve(__dirname, "../src/app/(authed)/sign-in/[[...sign-in]]/page.tsx"), "utf8");
    expect(signIn).toContain("Email me a code instead");
    expect(signIn).toContain('attemptFirstFactor({ strategy: "email_code", code })');
  });
});
