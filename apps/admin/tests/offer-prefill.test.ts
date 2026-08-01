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

describe("the admin offer cards wire both buttons", () => {
  const card = src("src/components/settings/brand-user-fields-card.tsx");
  const form = src("src/lib/user-fields-form.ts");

  it("runs BOTH cards in suggest mode, bypassing the cache", () => {
    expect(card).toContain('mode: "suggest"');
    expect(card).toContain("resetCache: true");
    // The services card used to run the default `extract`, which is site-grounded and
    // returns the literal string "Unknown" for anything the site does not state.
    expect(card).not.toContain('mode: "extract"');
  });

  it("asks brand-service to IGNORE what the user already confirmed, scoped to the card", () => {
    // brand-service injects a brand's confirmed fields into the generation prompt as
    // authoritative AND overlays them onto the response. Scoping the list to this
    // card's own keys is what lets the levers card still see the confirmed services
    // it generates from.
    expect(card).toContain("regenerateFieldKeys: [...prefillKeys]");
  });

  it("labels the buttons for what they do", () => {
    expect(card).toContain("Update services from my website");
    expect(card).toContain("Update the offer from my website");
    expect(card).not.toContain("Prefill from services");
    expect(card).not.toContain("Prefill with AI");
  });

  it("asks for dreamOutcome directly — the valueProposition remap is gone", () => {
    // The extraction prompt names the requested JSON keys verbatim, so asking for
    // `valueProposition` made the model write a generic value proposition.
    expect(form).not.toContain("EXTRACT_KEY_FOR_FIELD");
    expect(card).not.toContain("EXTRACT_KEY_FOR_FIELD");
    expect(form).not.toContain('dreamOutcome: "valueProposition"');
  });

  it("stops smearing the services into every lever description", () => {
    // brand-service already injects the brand's CONFIRMED fields as authoritative
    // context, so repeating the services in front of all six levers was noise the
    // model had to fight — and it duplicated the Hormozi framing the server applies.
    expect(form).not.toContain("HORMOZI_LEVER_GUIDANCE");
    expect(form).not.toContain("buildExtractDefs");
    expect(form).not.toContain("This brand sells the following services");
  });

  it("blocks the levers button until the services are saved", () => {
    expect(card).toContain("leversBlockedOnServices");
    expect(card).toContain("Save the brand");
  });
});
