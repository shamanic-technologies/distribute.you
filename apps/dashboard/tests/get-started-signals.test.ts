import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { GET_STARTED_STEPS, REOPENABLE_STEPS, parseGetStartedSnapshot, signalWrites, stepIndex } from "../src/lib/v2/get-started";
import { anonCallAllowed } from "../src/lib/anon-proxy-allowlist";

/**
 * The signals step of /get-started (owner 2026-10-16): right after the audience, the offer's
 * checks as one column of cards, all ticked, none required, each with a Must have / Nice to have
 * toggle prefilled with the AI's pick. A ticked one is turned on in that role; an unticked one never.
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

  it("turns each ticked check ON in the role on its toggle, and leaves unticked ones off", () => {
    const checks = [
      { id: "a", enabled: false, mode: "mention" as const },
      { id: "b", enabled: false, mode: "mention" as const },
      { id: "c", enabled: false, mode: "must_pass" as const },
    ];
    const roles = { a: "mention" as const, b: "mention" as const, c: "must_pass" as const };
    expect(signalWrites(checks, new Set(["a", "c"]), roles)).toEqual([
      { id: "a", patch: { enabled: true, mode: "mention" } },
      { id: "c", patch: { enabled: true, mode: "must_pass" } },
    ]);
    // The visitor flipped the AI's must-have to nice to have.
    expect(signalWrites(checks, new Set(["c"]), { ...roles, c: "mention" })).toEqual([{ id: "c", patch: { enabled: true, mode: "mention" } }]);
    // Zero ticked is allowed: nothing is turned on.
    expect(signalWrites(checks, new Set(), roles)).toEqual([]);
  });

  it("turns off a check that is on and was unticked, and leaves one already as asked alone", () => {
    const checks = [
      { id: "on", enabled: true, mode: "must_pass" as const },
      { id: "off", enabled: true, mode: "mention" as const },
    ];
    expect(signalWrites(checks, new Set(["on"]), { on: "must_pass", off: "mention" })).toEqual([{ id: "off", patch: { enabled: false } }]);
    // An enabled check whose toggle moved is rewritten in its new role.
    expect(signalWrites(checks, new Set(["on", "off"]), { on: "mention", off: "mention" })).toEqual([{ id: "on", patch: { enabled: true, mode: "mention" } }]);
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
    expect(confirm).toContain("for (const w of signalWrites(signals, signalTicks, signalRoles)) await updateOfferQualificationCriterion(brandId, o.offerId, w.id, w.patch);");
  });

  it("is a big count, one line, one column of ticked cards with a Must have / Nice to have toggle, and Continue", () => {
    expect(stage).toContain("Nice to have adds the fact to your emails. Must have keeps only the companies that pass.");
    expect(stage).toContain('aria-pressed={picked}');
    expect(stage).toContain('picked ? "k-card-on" : ""');
    expect(stage).toContain('<div className="grid grid-cols-[minmax(0,1fr)] gap-3">');
    expect(stage).not.toContain("sm:grid-cols-2");
    expect(stage).toContain('role="radiogroup"');
    expect(PAGE).toContain('{ key: "must_pass", label: "Must have" }');
    expect(PAGE).toContain('{ key: "mention", label: "Nice to have" }');
    // The toggle opens on what the AI recommended; the card title is lead-service's short title.
    expect(PAGE).toContain("return c.recommendation?.mode ?? c.mode;");
    expect(PAGE).toContain("return c.title?.trim() || c.question;");
    expect(PAGE).toContain("setSignalRoles(Object.fromEntries(checks.map((c) => [c.id, recommendedRole(c)])));");
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

  it("runs the ticked signals on the preview companies and polls them (owner 2026-10-17)", () => {
    expect(allow("POST", `/brands/${BRAND}/offers/o1/qualification/previews`).allowed).toBe(true);
    expect(allow("GET", `/brands/${BRAND}/offers/o1/qualification/previews/p1`).allowed).toBe(true);
    expect(allow("POST", `/brands/${OTHER}/offers/o1/qualification/previews`).refusal).toBe("wrong-brand");
  });

  it("refuses another brand, creating or archiving a check, and running one on leads", () => {
    expect(allow("POST", `/brands/${OTHER}/offers/o1/qualification/suggestions`).refusal).toBe("wrong-brand");
    expect(allow("POST", `/brands/${BRAND}/offers/o1/qualification/criteria`).allowed).toBe(false);
    expect(allow("DELETE", `/brands/${BRAND}/offers/o1/qualification/criteria/c1`).allowed).toBe(false);
    expect(allow("POST", `/brands/${BRAND}/offers/o1/qualification/criteria/c1/sample`).allowed).toBe(false);
  });
});
