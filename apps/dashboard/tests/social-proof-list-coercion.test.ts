import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { coerceListField } from "../src/lib/strategy-model";
import {
  formatListLeverValue,
  isListLever,
  parseListLeverInput,
} from "../src/components/onboarding/offer-levers";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// Regression: socialProof is a list-kind offer lever. The post-payment offer step used
// to write it back as the raw <textarea> string, clobbering the array; the Strategy page
// then rendered `Array.isArray(value) ? value : []` → a string collapsed to [] → the
// "Social proof shows empty" bug. Both parts are guarded here.

describe("coerceListField — heals a legacy STRING socialProof on display", () => {
  it("passes an array through, trimming empties", () => {
    expect(coerceListField(["115+ D2C brands analyzed", "  Trusted by X  ", ""])).toEqual([
      "115+ D2C brands analyzed",
      "Trusted by X",
    ]);
  });

  it("coerces a newline-joined string (the confirmed prod corruption) to >=1 item", () => {
    const legacy = "115+ D2C brands analyzed\n\nSpecialized AI\n\nFull sample";
    const out = coerceListField(legacy);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out).toEqual(["115+ D2C brands analyzed", "Specialized AI", "Full sample"]);
  });

  it("coerces a comma-joined string (join(', ') corruption) to items", () => {
    expect(coerceListField("Acme, Globex, Initech")).toEqual(["Acme", "Globex", "Initech"]);
  });

  it("returns [] for null / undefined / non-string", () => {
    expect(coerceListField(null)).toEqual([]);
    expect(coerceListField(undefined)).toEqual([]);
    expect(coerceListField("   ")).toEqual([]);
  });
});

describe("offer-lever list handling — writes socialProof as a string[]", () => {
  it("marks socialProof (and only it) a list lever", () => {
    expect(isListLever("socialProof")).toBe(true);
    expect(isListLever("valueProposition")).toBe(false);
    expect(isListLever("riskReversal")).toBe(false);
  });

  it("parseListLeverInput splits textarea content into a trimmed, non-empty array", () => {
    const arr = parseListLeverInput("115+ D2C brands analyzed\n  Specialized AI  \n\n");
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toEqual(["115+ D2C brands analyzed", "Specialized AI"]);
  });

  it("format→parse round-trips an array losslessly", () => {
    const items = ["Case study A", "Testimonial B", "Notable client C"];
    expect(parseListLeverInput(formatListLeverValue(items))).toEqual(items);
  });
});

describe("source guards — the clobbering / collapsing patterns are gone", () => {
  it("Strategy page renders the ListEditor via coerceListField, not Array.isArray-collapse", () => {
    const src = read("../src/components/strategy/strategy-page.tsx");
    expect(src).toMatch(/values=\{coerceListField\(value\)\}/);
    expect(src).not.toMatch(/values=\{Array\.isArray\(value\) \? value : \[\]\}/);
  });

  it("onboarding offer step splits list levers instead of writing the raw string", () => {
    const src = read("../src/components/onboarding/onboarding.tsx");
    expect(src).toMatch(/isList \? parseListLeverInput\(e\.target\.value\) : e\.target\.value/);
  });
});
