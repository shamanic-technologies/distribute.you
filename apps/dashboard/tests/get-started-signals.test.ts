import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { GET_STARTED_STEPS, REOPENABLE_STEPS, parseGetStartedSnapshot, signalWrites, stepIndex } from "../src/lib/v2/get-started";
import { anonCallAllowed } from "../src/lib/anon-proxy-allowlist";

/**
 * The signals step of /get-started (owner 2026-10-16): right after the audience, the offer's
 * checks as cards, all ticked, none required. A signal is never a filter: a ticked one is turned
 * on as a MENTION (its proof goes to the email writer), an unticked one is never turned on.
 */

const PAGE = readFileSync(resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf-8");
const API = readFileSync(resolve(__dirname, "../src/lib/api.ts"), "utf-8");
const stage = PAGE.slice(PAGE.indexOf("export function SignalsStage("), PAGE.indexOf("function ValueStage("));

describe("the signals step", () => {
  it("sits right after the audience pick, before what a client is worth, and Back reopens it", () => {
    expect(stepIndex("signals")).toBe(stepIndex("audience") + 1);
    expect(GET_STARTED_STEPS[stepIndex("signals") + 1].key).toBe("value");
    expect(REOPENABLE_STEPS.has("signals")).toBe(true);
  });

  it("turns ticked checks ON as mentions, never a filter, and leaves unticked ones off", () => {
    const checks = [
      { id: "a", enabled: false, mode: "mention" as const },
      { id: "b", enabled: false, mode: "mention" as const },
      { id: "c", enabled: false, mode: "must_pass" as const },
    ];
    expect(signalWrites(checks, new Set(["a", "c"]))).toEqual([
      { id: "a", patch: { enabled: true, mode: "mention" } },
      { id: "c", patch: { enabled: true, mode: "mention" } },
    ]);
    // Zero ticked is allowed: nothing is turned on.
    expect(signalWrites(checks, new Set())).toEqual([]);
  });

  it("turns off a check that is on and was unticked, and leaves an existing one as it is", () => {
    const checks = [
      { id: "on", enabled: true, mode: "must_pass" as const },
      { id: "off", enabled: true, mode: "mention" as const },
    ];
    expect(signalWrites(checks, new Set(["on"]))).toEqual([{ id: "off", patch: { enabled: false } }]);
  });

  it("keeps the step's confirmation across a reload", () => {
    const snap = { version: 2, website: "https://acme.com", brandId: "b1", signalsDone: true };
    expect(parseGetStartedSnapshot(JSON.stringify(snap))?.signalsDone).toBe(true);
    expect(parseGetStartedSnapshot(JSON.stringify({ ...snap, signalsDone: "yes" }))?.signalsDone).toBe(false);
  });

  it("reads the offer's checks, else asks lead-service to suggest them, all ticked", () => {
    const prep = PAGE.slice(PAGE.indexOf("async function prepareSignals("), PAGE.indexOf("async function draftAnswers("));
    expect(prep).toContain("listOfferQualificationCriteria(id, offerId)");
    expect(prep).toContain("suggestOfferQualificationCriteria(id, offerId)");
    expect(prep).toContain("setSignalTicks(new Set(checks.map((c) => c.id)))");
    // Prepared as soon as the offer is saved, while the audience is picked.
    expect(PAGE).toContain("void prepareSignals(id, chosenOfferId);");
    expect(API).toContain("`${qualificationBase(brandId, offerId)}/suggestions`");
  });

  it("writes only what signalWrites says on Continue", () => {
    const confirm = PAGE.slice(PAGE.indexOf("async function confirmSignals("), PAGE.indexOf("async function confirmValue("));
    expect(confirm).toContain("for (const w of signalWrites(signals, signalTicks)) await updateOfferQualificationCriterion(brandId, o.offerId, w.id, w.patch);");
  });

  it("is a big count, one line, ticked cards and Continue, with nothing required", () => {
    expect(stage).toContain("Signals never filter anyone out. Each signal adds a fact to your emails to lift replies.");
    expect(stage).toContain('aria-pressed={picked}');
    expect(stage).toContain('picked ? "k-card-on" : "k-hover"');
    expect(stage).toContain("text-[40px]");
    // Continue is never disabled for want of a tick.
    const footer = stage.slice(stage.indexOf("footer={"), stage.indexOf("Continue"));
    expect(footer).not.toContain("disabled");
    expect(stage).not.toMatch(/[–—]/);
  });
});

describe("the signed-out session reaches the signals routes on its own brand only", () => {
  const BRAND = "0f7c1a2e-0000-4000-8000-000000000003";
  const OTHER = "0f7c1a2e-0000-4000-8000-00000000dead";
  const allow = (method: string, endpoint: string) => anonCallAllowed({ method, endpoint, brandId: BRAND });

  it("suggests, reads and toggles the offer's checks", () => {
    expect(allow("POST", `/brands/${BRAND}/offers/o1/qualification/suggestions`).allowed).toBe(true);
    expect(allow("GET", `/brands/${BRAND}/offers/o1/qualification/criteria`).allowed).toBe(true);
    expect(allow("PATCH", `/brands/${BRAND}/offers/o1/qualification/criteria/c1`).allowed).toBe(true);
  });

  it("refuses another brand, creating or archiving a check, and running one on leads", () => {
    expect(allow("POST", `/brands/${OTHER}/offers/o1/qualification/suggestions`).refusal).toBe("wrong-brand");
    expect(allow("POST", `/brands/${BRAND}/offers/o1/qualification/criteria`).allowed).toBe(false);
    expect(allow("DELETE", `/brands/${BRAND}/offers/o1/qualification/criteria/c1`).allowed).toBe(false);
    expect(allow("POST", `/brands/${BRAND}/offers/o1/qualification/criteria/c1/sample`).allowed).toBe(false);
  });
});
