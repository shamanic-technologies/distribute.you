import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heldAudienceChoice, resumedAudienceList, signalTicksOnRead } from "../src/lib/v2/get-started";

/**
 * 2026-11-23, a real client (netzrecruiter.com): walked signed out, picked two audiences, signed
 * up on /sign-up, resumed the SAME brand signed in. He was never asked a monthly limit, step 4
 * showed an error with a Try again that drafted a second list (two audiences became four), the
 * signals step searched for ever, and Launch opened a box over the walk.
 */
const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const walk = read("components/v2/get-started/get-started.tsx");
const launch = read("components/v2/get-started/org-launch.tsx");
const journal = read("components/v2/get-started/journal.tsx");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("monthly limit: asked wherever none is set yet, signed in or not", () => {
  it("the org walk reads billing's limit and asks only an org that has none", () => {
    expect(walk).toContain('l.monthly_charge_limit_cents == null ? ("none" as const) : ("set" as const)');
    expect(walk).toContain('const limitAsked = !org || orgLimit === "none";');
    expect(walk).toContain("limitPrefillUsd={limitAsked ? DEFAULT_MONTHLY_LIMIT_USD : null}");
    // No longer "signup only".
    expect(stripComments(walk)).not.toContain("limitPrefillUsd={org ? null");
  });

  it("an org whose limit could not be read is not launched past it", () => {
    const at = walk.indexOf("function confirmCampaign(");
    const body = walk.slice(at, walk.indexOf("async function confirmSignals(", at));
    expect(body).toContain('if (org && (orgLimit === "unread" || orgLimit === "failed"))');
    expect(body.indexOf('orgLimit === "failed"')).toBeLessThan(body.indexOf("setWallOpen(true)"));
    expect(body).toContain("monthlyLimitToSave(campaignDraft.monthlyLimit, limitFloorArm)");
  });

  it("the launch step gets the limit only for an org with none, and saves it before any charge or launch", () => {
    expect(walk).toContain('monthlyLimit={orgLimit === "none" ? campaignDraft.monthlyLimit : undefined}');
    expect(launch).toContain("if (monthlyLimit === undefined) return true;");
    expect(launch).toContain("await setMonthlyChargeLimit(limit.usd * 100);");
    const pay = launch.slice(launch.indexOf("async function pay("), launch.indexOf("async function afterPaid("));
    expect(pay.indexOf("saveLimit(choice.topupUsd)")).toBeGreaterThan(-1);
    expect(pay.indexOf("saveLimit(choice.topupUsd)")).toBeLessThan(pay.indexOf("payTopup("));
    // An org that already pays: saved before its launch too.
    const ready = launch.slice(launch.indexOf("async function launchReady("), launch.indexOf("async function launch("));
    expect(ready.indexOf("saveLimit(1)")).toBeLessThan(ready.indexOf("void launch()"));
    expect(launch).toContain("onClick={() => void launchReady()}");
    const check = launch.slice(launch.indexOf("async function checkCard("), launch.indexOf("async function openCardSave("));
    expect(check.indexOf("saveLimit(1)")).toBeLessThan(check.indexOf("putPostpaid()"));
    // The credit step names the limit in its statement, like the signup wall.
    expect(launch).toContain("monthlyLimit={monthlyLimit} cta=");
  });
});

describe("step 4 on a resumed brand: its own audiences, never a second list", () => {
  it("the list a walk showed comes back with the pick in it", () => {
    const pick = { audienceId: "a1", name: "Austria MDs", description: "MDs in Austria" };
    const shown = [
      { name: "Germany MDs", description: "", icon: "x", iconConfidence: 1 },
      { name: "Austria MDs", description: "MDs in Austria", icon: "x", iconConfidence: 1 },
    ];
    expect(resumedAudienceList({ audience: pick, audienceProposals: shown })).toEqual(shown);
    // A pick with no saved list still shows: the step is never empty beside a picked audience.
    expect(resumedAudienceList({ audience: pick, audienceProposals: null })).toEqual([{ name: "Austria MDs", description: "MDs in Austria", icon: "", iconConfidence: 0 }]);
    expect(resumedAudienceList({ audience: pick, audienceProposals: [shown[0]] }).map((a) => a.name)).toEqual(["Austria MDs", "Germany MDs"]);
    expect(resumedAudienceList({ audience: null, audienceProposals: null })).toEqual([]);
  });

  it("the audiences an offer already holds: the live ones, the last made picked", () => {
    const rows = [
      { id: "g", name: "Germany MDs", description: "DE", status: "active", createdAt: "2026-11-23T18:09:53Z" },
      { id: "a", name: "Austria MDs", description: null, status: "active", createdAt: "2026-11-23T18:10:13Z" },
      { id: "z", name: "Old", description: "", status: "archived", createdAt: "2026-11-23T18:20:00Z" },
    ];
    const held = heldAudienceChoice(rows);
    expect(held.list.map((a) => a.name)).toEqual(["Germany MDs", "Austria MDs"]);
    expect(held.picked).toEqual({ audienceId: "a", name: "Austria MDs", description: "" });
    expect(heldAudienceChoice([])).toEqual({ list: [], picked: null });
    expect(heldAudienceChoice([rows[2]]).picked).toBeNull();
  });

  it("the walk restores the list with the snapshot and asks the offer's audiences before drafting any", () => {
    const apply = walk.slice(walk.indexOf("function applySnapshot("), walk.indexOf("function resumePreparing("));
    expect(apply).toContain("setAudienceProposals(resumedAudienceList(s));");
    expect(apply).toContain("createdAudiences.current.set(s.audience.name, s.audience);");
    const prep = walk.slice(walk.indexOf("async function prepareAudiences("), walk.indexOf("function advance("));
    const held = prep.indexOf("heldAudienceChoice((await listAudiences(id, { offerId, limit: 100 })).audiences)");
    expect(held).toBeGreaterThan(-1);
    expect(held).toBeLessThan(prep.indexOf("suggestBrandIcp("));
    expect(held).toBeLessThan(prep.indexOf("proposeAudienceSegments("));
    expect(prep).toContain("chooseAudience(picked);");
    // Every resume path goes through it: no split asked straight from the snapshot.
    const resume = walk.slice(walk.indexOf("function resumePreparing("), walk.indexOf("function saveSnapshot("));
    expect(resume).not.toContain("proposeAudienceSegments(");
    expect(resume).toContain("void prepareAudiences(s.brandId, s.offer.offerId, s.icp || null)");
  });

  it("held audiences shown with a pick carry Continue", () => {
    expect(walk).toContain('onContinue={steps.audience === "done" && !focus && audience ? () => advance("audience") : null}');
    expect(walk).toContain("footer={onContinue ? <NextButton onNext={onContinue} /> : undefined}");
  });
});

describe("signals on a resumed walk: read back, never searched for ever", () => {
  it("a resumed walk always reads its signals, saved ones without a new suggestion", () => {
    const resume = walk.slice(walk.indexOf("function resumePreparing("), walk.indexOf("function saveSnapshot("));
    expect(resume).toContain("if (s.offer) void prepareSignals(s.brandId, s.offer.offerId, !!s.signalsDone || s.lifetimeRevenueUsd != null);");
    const prep = walk.slice(walk.indexOf("async function prepareSignals("), walk.indexOf("async function draftAnswers("));
    expect(prep).toContain("held.length > 0 || saved ? held : await suggestOfferQualificationCriteria(id, offerId)");
  });

  it("ticks: everything on a first read, what was saved on a resumed walk", () => {
    const checks = [
      { id: "1", enabled: true, mode: "must_pass" as const, recommendation: { mode: "mention" as const } },
      { id: "2", enabled: false, mode: "mention" as const, recommendation: { mode: "must_pass" as const } },
    ];
    expect(signalTicksOnRead(checks, false)).toEqual({ ticked: ["1", "2"], roles: { "1": "mention", "2": "must_pass" } });
    expect(signalTicksOnRead(checks, true)).toEqual({ ticked: ["1"], roles: { "1": "must_pass", "2": "must_pass" } });
    // Saved flag but nothing on (the save never landed): the first-read ticks.
    expect(signalTicksOnRead([checks[1]], true).ticked).toEqual(["2"]);
  });
});

describe("the org walk's launch is a step in the page, never a box over it (owner 2026-11-24)", () => {
  const code = stripComments(launch);
  it("draws no overlay, dialog or close cross", () => {
    expect(code).not.toContain("fixed inset-0");
    expect(code).not.toContain('role="dialog"');
    expect(code).not.toContain("aria-modal");
    expect(code).not.toContain("k-popover");
    expect(code).not.toContain("createPortal");
    expect(code).toContain('<section className="gs-fade k-card relative overflow-hidden p-4"');
    expect(code).toContain("← Back");
  });

  it("is mounted on the stage in place of the step, inside <main>", () => {
    const main = walk.slice(walk.indexOf('<main className="k-scroll'), walk.indexOf("</main>"));
    expect(main).toContain("{orgLaunchOpen && org && brandId && offer && launchPlan ? (");
    expect(main).toContain("<OrgLaunch");
    expect(walk.match(/<OrgLaunch/g)?.length).toBe(1);
    expect(main.indexOf("<OrgLaunch")).toBeLessThan(main.indexOf("{stageFor(stagedKey)}"));
  });

  it("says so when the card form cannot load or billing hands none", () => {
    expect(launch).toContain("if (live && !stripe) setError(CARD_FORM_BLOCKED);");
    const pay = read("components/v2/get-started/pay-topup.ts");
    expect(pay).toContain("if (!session.client_secret) {");
  });
});

describe("the recap is read-only: moving is Back and Continue (owner 2026-11-24)", () => {
  const code = stripComments(journal);
  it("no entry moves the walk or changes a pick", () => {
    expect(code).not.toContain("onFocus");
    expect(code).not.toContain("onPickAudience");
    expect(code).not.toContain("k-hover -mx-1");
    // The one button left opens the rest of the competitors list in place.
    expect(code.match(/<button/g)?.length).toBe(1);
    expect(code.match(/onClick=/g)?.length).toBe(1);
    expect(code).toContain("onClick={() => setAll((v) => !v)}");
    expect(stripComments(walk)).not.toContain("function openStep(");
  });

  it("the recap names the campaign in interested leads, as its step does", () => {
    expect(walk).toContain("(estimate ? targetLabel(estimate) : PRICING_TARGET_LABEL)");
  });
});
