import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { coerceTextField, coerceListField } from "../src/lib/strategy-model";
import { cloneFields, ALL_FIELDS } from "../src/components/brand-profile/field-editor";
import { isListLeverKey } from "../src/components/onboarding/offer-levers";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// Regression: the 6 Hormozi offer levers are stored as free-form JSON by brand-service
// (the `kind` text-vs-list is a dashboard-only concept), so the SAME key comes back as a
// bare string on one extraction run and a string[] of bullet points on the next. The
// text-kind levers (perceivedLikelihood, riskReversal, urgency, scarcity, dreamOutcome)
// used to hit `typeof value === "string" ? value : ""`, which
//   (a) rendered a stored array as the placeholder — "not set" on a lever the user filled;
//   (b) on the next Save wrote a confirmed-EMPTY row over it, deleting it for good.
// Confirmed in prod: riskReversal/urgency arrays on 6 brands each, scarcity 5,
// perceivedLikelihood 3, dreamOutcome 1. This is the mirror of the socialProof
// string-in-a-list bug already guarded by social-proof-list-coercion.test.ts.

describe("coerceTextField — heals an ARRAY stored in a text-kind lever", () => {
  it("joins a list of proof points on newline", () => {
    expect(
      coerceTextField([
        "Full refund guaranteed if the custom report does not fit your case",
        "Free rewrite included before refund",
        "7-day refund guarantee on the Template Pack",
      ]),
    ).toBe(
      "Full refund guaranteed if the custom report does not fit your case\n" +
        "Free rewrite included before refund\n" +
        "7-day refund guarantee on the Template Pack",
    );
  });

  it("trims items and drops empty ones", () => {
    expect(coerceTextField(["  Delivered within 48 hours  ", "", "   ", "Act today"])).toBe(
      "Delivered within 48 hours\nAct today",
    );
  });

  it("passes a real string straight through, untouched", () => {
    const s = "Skip the $500 stack mistake and get the exact cold email stack.";
    expect(coerceTextField(s)).toBe(s);
  });

  it("returns an empty string for null / undefined / empty array", () => {
    expect(coerceTextField(null)).toBe("");
    expect(coerceTextField(undefined)).toBe("");
    expect(coerceTextField([])).toBe("");
  });

  it("never returns '' for an array that carries content (the whole bug)", () => {
    expect(coerceTextField(["Strictly limited to 5 custom reports per week"])).not.toBe("");
  });
});

describe("cloneFields — normalises every key to its DECLARED kind", () => {
  it("turns an array in a text-kind lever into the joined string, not ''", () => {
    const out = cloneFields({
      riskReversal: ["Full refund", "Free rewrite"],
      urgency: ["Delivered within 48 hours"],
      scarcity: ["5 reports per week"],
      perceivedLikelihood: ["Hands-on testing"],
    });
    expect(out.riskReversal).toBe("Full refund\nFree rewrite");
    expect(out.urgency).toBe("Delivered within 48 hours");
    expect(out.scarcity).toBe("5 reports per week");
    expect(out.perceivedLikelihood).toBe("Hands-on testing");
  });

  it("still heals a bare string in a list-kind field (socialProof, services)", () => {
    const out = cloneFields({
      socialProof: "20+ tools reviewed\n12 guides published",
      services: "Selection Report, Template Pack",
    });
    expect(out.socialProof).toEqual(["20+ tools reviewed", "12 guides published"]);
    expect(out.services).toEqual(["Selection Report", "Template Pack"]);
  });

  it("defaults a missing key to the empty value of its kind", () => {
    const out = cloneFields({});
    for (const f of ALL_FIELDS) {
      expect(out[f.key]).toEqual(f.kind === "list" ? [] : "");
    }
  });

  it("clones arrays so an edit cannot mutate the saved baseline", () => {
    const source = { socialProof: ["a", "b"] };
    const out = cloneFields(source);
    (out.socialProof as string[]).push("c");
    expect(source.socialProof).toEqual(["a", "b"]);
  });
});

describe("the save path can no longer blank a lever it did not touch", () => {
  // profileToUserFieldsPayload is module-private to strategy-page; its text branch is
  // fed by cloneFields, so the guarantee is: after cloneFields, every text-kind value is
  // already a string, and `.trim()` on it preserves the content.
  it("a text-kind array survives clone -> trim as non-empty", () => {
    const cloned = cloneFields({ riskReversal: ["Full refund", "Free rewrite"] });
    expect((cloned.riskReversal as string).trim()).not.toBe("");
  });
});

describe("isListLeverKey — the 7-key kind map used to seed onboarding", () => {
  it("matches ALL_FIELDS' declared kind for every user field", () => {
    for (const f of ALL_FIELDS) {
      expect(isListLeverKey(f.key)).toBe(f.kind === "list");
    }
  });
});

describe("source guards", () => {
  const strategyPage = read("../src/components/strategy/strategy-page.tsx");
  const fieldEditor = read("../src/components/brand-profile/field-editor.tsx");
  const onboarding = read("../src/components/onboarding/onboarding.tsx");

  it("cloneFields coerces by kind rather than passing the raw value through", () => {
    expect(fieldEditor).toContain('f.kind === "list" ? coerceListField(v) : coerceTextField(v)');
  });

  it("the Strategy offer editor still reads its baseline through cloneFields", () => {
    expect(strategyPage).toContain("cloneFields(userFieldsToProfile(");
  });

  it("the Strategy TextEditor coerces instead of dropping a non-string to ''", () => {
    expect(strategyPage).toContain("value={coerceTextField(value)}");
  });

  it("the onboarding offer step joins a text lever instead of comma-joining it raw", () => {
    expect(onboarding).toContain("isList ? formatListLeverValue(raw) : coerceTextField(raw)");
    expect(onboarding).not.toContain('raw.join(", ")');
  });

  it("onboarding normalises the seeded user-fields to each lever's kind", () => {
    expect(onboarding).toContain(
      "seeded[key] = isListLeverKey(key) ? coerceListField(v) : coerceTextField(v)",
    );
  });

  it("coerceListField and coerceTextField stay mirror halves of the same guard", () => {
    expect(coerceListField("a\nb")).toEqual(["a", "b"]);
    expect(coerceTextField(["a", "b"])).toBe("a\nb");
  });
});
