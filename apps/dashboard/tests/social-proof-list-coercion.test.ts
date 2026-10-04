import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { coerceListField } from "../src/lib/strategy-model";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// Regression: socialProof is a list-kind offer lever. The post-payment offer step used
// to write it back as the raw <textarea> string, clobbering the array; the Strategy page
// then rendered `Array.isArray(value) ? value : []` → a string collapsed to [] → the
// "Social proof shows empty" bug. The display heal and the Brand Settings editor are
// guarded here (the v1 onboarding offer step and its lever helpers are deleted).

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

describe("source guards — the clobbering / collapsing patterns are gone", () => {
  it("Brand Settings offer editor splits list levers by line, never collapses a legacy string", () => {
    const src = read("../src/components/settings/brand-offer-card.tsx");
    expect(src).toContain("function linesToList(");
    expect(src).not.toMatch(/values=\{Array\.isArray\(value\) \? value : \[\]\}/);
  });
});
