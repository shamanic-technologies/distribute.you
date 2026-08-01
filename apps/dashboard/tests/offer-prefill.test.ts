import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyExtractionToDraft,
  prefillDefsFor,
  LEVER_PREFILL_KEYS,
  SERVICES_PREFILL_KEYS,
  type PrefillFieldDef,
} from "../src/lib/offer-prefill";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// A stand-in for USER_PROFILE_FIELDS. The lib takes the defs as an argument, so it
// stays alias-free and runtime-importable by vitest.
const DEFS: PrefillFieldDef[] = [
  { key: "services", description: "The distinct paid services or products…" },
  { key: "dreamOutcome", description: "Dream outcome: the specific end result…" },
  { key: "perceivedLikelihood", description: "Perceived likelihood of success…" },
  { key: "socialProof", description: "Social proof: case studies…" },
  { key: "riskReversal", description: "Risk reversal: trials, guarantees…" },
  { key: "urgency", description: "Urgency elements and time pressure" },
  { key: "scarcity", description: "Scarcity and limited availability" },
  { key: "companyOverview", description: "Company overview" },
];

describe("offer prefill — the two buttons ask for disjoint halves of the offer", () => {
  it("the services button asks for services and nothing else", () => {
    const defs = prefillDefsFor(SERVICES_PREFILL_KEYS, DEFS);
    expect(defs.map((d) => d.key)).toEqual(["services"]);
    // The description comes from the shared set, so a lever means the same thing in
    // onboarding, on this page and in the admin console.
    expect(defs[0].description).toBe(DEFS[0].description);
  });

  it("the offer button asks for the 6 Hormozi levers, never for services", () => {
    const keys = prefillDefsFor(LEVER_PREFILL_KEYS, DEFS).map((d) => d.key);
    expect(keys).toEqual([
      "dreamOutcome",
      "perceivedLikelihood",
      "socialProof",
      "riskReversal",
      "urgency",
      "scarcity",
    ]);
    expect(keys).not.toContain("services");
  });

  it("asks for dreamOutcome under its OWN key, never valueProposition", () => {
    // The extraction prompt names the requested JSON keys verbatim, so asking for
    // `valueProposition` (as the admin console used to) makes the model write a
    // generic value proposition instead of the dream outcome the lever is about.
    // `valueProposition` remains a separate backend-extract field.
    const keys = prefillDefsFor(LEVER_PREFILL_KEYS, DEFS).map((d) => d.key);
    expect(keys).toContain("dreamOutcome");
    expect(keys).not.toContain("valueProposition");
  });

  it("drops a key the shared set does not describe rather than inventing one", () => {
    expect(prefillDefsFor(["nope"], DEFS)).toEqual([]);
  });

  it("together the two buttons cover the 7 user-fields exactly once", () => {
    const all = [...SERVICES_PREFILL_KEYS, ...LEVER_PREFILL_KEYS];
    expect(all).toHaveLength(7);
    expect(new Set(all).size).toBe(7);
  });
});

describe("applyExtractionToDraft — a RESET, scoped to the button's own fields", () => {
  const listDef = { key: "socialProof", kind: "list" as const };
  const textDef = { key: "urgency", kind: "text" as const };

  it("takes the extracted value for a list field, trimming and dropping blanks", () => {
    const next = applyExtractionToDraft({}, [listDef], {
      socialProof: ["  Acme  ", "", "Globex"],
    });
    expect(next.socialProof).toEqual(["Acme", "Globex"]);
  });

  it("splits a bare string into items rather than keeping one blob", () => {
    const next = applyExtractionToDraft({}, [listDef], { socialProof: "Acme\n\nGlobex" });
    expect(next.socialProof).toEqual(["Acme", "Globex"]);
  });

  it("joins an array onto a text field instead of blanking it", () => {
    // Extraction is generative, so a text-kind lever regularly arrives as string[].
    const next = applyExtractionToDraft({}, [textDef], { urgency: ["Q1 close", "Seats cap"] });
    expect(next.urgency).toBe("Q1 close\nSeats cap");
  });

  it("CLEARS a field the extraction did not answer", () => {
    // The button says "update from my website"; leaving the old value would mean it
    // did not. Nothing is persisted until the user saves.
    const next = applyExtractionToDraft(
      { urgency: "old copy", socialProof: ["old"] },
      [listDef, textDef],
      {},
    );
    expect(next.urgency).toBe("");
    expect(next.socialProof).toEqual([]);
  });

  it("leaves fields outside the button's own set untouched", () => {
    // The services button must not disturb the levers, and vice versa.
    const next = applyExtractionToDraft(
      { services: ["Consulting"], urgency: "kept" },
      [listDef],
      { socialProof: ["New"] },
    );
    expect(next.services).toEqual(["Consulting"]);
    expect(next.urgency).toBe("kept");
  });

  it("does not mutate the draft it is given", () => {
    const draft = { urgency: "before" };
    applyExtractionToDraft(draft, [textDef], { urgency: "after" });
    expect(draft.urgency).toBe("before");
  });
});

describe("the offer card wires both buttons", () => {
  const page = src("src/components/strategy/strategy-page.tsx");

  it("renders one button per half, in suggest mode, bypassing the cache", () => {
    expect(page).toContain("Update services from my website");
    expect(page).toContain("Update the offer from my website");
    expect(page).toContain('mode: "suggest"');
    expect(page).toContain("resetCache: true");
    // extract mode returns the literal string "Unknown" for anything the site does
    // not state outright, which is not a value anyone wants to read in a field.
    expect(page).not.toContain('mode: "extract"');
  });

  it("asks brand-service to IGNORE what the user already confirmed", () => {
    // brand-service injects a brand's confirmed fields into the generation prompt as
    // authoritative AND overlays them onto the response, so without this a button
    // that says "update from my website" returns the user's own previous input.
    expect(page).toContain("regenerateFieldKeys: [...SERVICES_PREFILL_KEYS]");
    expect(page).toContain("regenerateFieldKeys: [...LEVER_PREFILL_KEYS]");
  });

  it("never regenerates the services from the LEVERS button", () => {
    // The levers are written FROM the services, so the services' confirmed value must
    // keep reaching the model as authoritative context. Listing them here would strip
    // exactly the input the levers are generated from.
    const at = page.indexOf("const prefillLeversMut");
    const body = page.slice(at, page.indexOf("const prefilling"));
    expect(body).toContain("regenerateFieldKeys: [...LEVER_PREFILL_KEYS]");
    expect(body).not.toContain("SERVICES_PREFILL_KEYS");
  });

  it("hides both buttons on a shared link and under a campaign", () => {
    // A share link is read-only, and under a campaign the offer is a preview with no
    // writer — a button that rewrites fields nobody can save is a dead control.
    expect(page).toContain("const offerEditable = !readOnly && !campaignScoped");
    expect(page).toContain("offerEditable ? (");
  });

  it("confirms dirty services before generating the levers", () => {
    // brand-service injects the brand's CONFIRMED fields as authoritative context, so
    // services typed but not saved are invisible to the generation.
    const at = page.indexOf("const prefillLeversMut");
    expect(at).toBeGreaterThan(-1);
    const body = page.slice(at, at + 900);
    expect(body).toContain("if (servicesDirty)");
    expect(body).toContain("saveBrandUserFields(brandId, { services: draftServices })");
  });

  it("never renders a backend error message to the user", () => {
    // `apiCall` puts the downstream response body verbatim into the Error message.
    const at = page.indexOf("const prefillServicesMut");
    const body = page.slice(at, page.indexOf("const prefilling"));
    expect(body).toContain("console.error");
    expect(body).not.toContain("err.message");
  });
});
