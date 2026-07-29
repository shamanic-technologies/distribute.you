import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// Mirror of apps/dashboard/tests/offer-lever-text-coercion.test.ts. The two apps share
// the same user-fields editor and must stay in lockstep, so the same shape-mismatch fix
// is guarded on both sides.
//
// Regression: brand-service stores the 7 user-fields as free-form JSON (the text-vs-list
// `kind` is a dashboard/admin concept), so a text-kind lever regularly comes back as a
// string[]. The old `typeof v === "string" ? v : ""` rendered such a value as "not set"
// and, on the next Save, wrote a confirmed-EMPTY row over it.
//
// user-fields-form.ts imports "@/lib/api" at runtime and vitest has no path-alias config
// in this repo, so these are source-substring guards over the function bodies, matching
// the existing user-fields-clear.test.ts convention.

const form = read("../src/lib/user-fields-form.ts");
const card = read("../src/components/settings/brand-user-fields-card.tsx");

const bodyAfter = (src: string, marker: string, len = 1200) => {
  const i = src.indexOf(marker);
  expect(i, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(i, i + len);
};

describe("coerceTextField exists and mirrors coerceListField", () => {
  it("is exported from user-fields-form", () => {
    expect(form).toContain("export const coerceTextField");
  });

  it("joins an array on newline rather than dropping it", () => {
    const body = bodyAfter(form, "export const coerceTextField", 500);
    expect(body).toContain("Array.isArray(v)");
    expect(body).toContain('.join("\\n")');
    expect(body).toContain('typeof v === "string" ? v : ""');
  });

  it("coerceListField returns a NEW array (cloneSubset relies on the clone)", () => {
    const body = bodyAfter(form, "export const coerceListField", 500);
    expect(body).toContain(".map(");
    // The old one-liner returned `v` itself, so an edit mutated the saved baseline.
    expect(body).not.toContain("Array.isArray(v) ? v :");
  });
});

describe("cloneSubset normalises to each field's declared kind", () => {
  it("coerces by kind instead of passing the raw value through", () => {
    const body = bodyAfter(form, "export function cloneSubset");
    expect(body).toContain('f.kind === "list" ? coerceListField(v) : coerceTextField(v)');
    expect(body).not.toContain("Array.isArray(v) ? [...v]");
  });
});

describe("profileToPayload can no longer blank a text-kind lever", () => {
  it("coerces the text branch instead of emitting '' for a non-string", () => {
    const body = bodyAfter(form, "export function profileToPayload");
    expect(body).toContain('f.kind === "list" ? coerceListField(v) : coerceTextField(v).trim()');
    expect(body).not.toContain('typeof v === "string"\n          ? v.trim()');
  });
});

describe("the card renders through the coercion", () => {
  it("TextEditor reads coerceTextField, not a typeof guard that drops arrays", () => {
    expect(card).toContain("value={coerceTextField(fields[f.key])}");
    expect(card).not.toContain('typeof fields[f.key] === "string" ? (fields[f.key] as string) : ""');
  });
});
