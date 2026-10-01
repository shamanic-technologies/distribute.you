import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const SECTION = read("src/components/leads/lead-stage-section.tsx");
// The ONE close-won form: two copies of "whose win was it, and what was it worth" is
// how one surface comes to ask a question the other does not, about the same deal.
const FORM = read("src/components/leads/close-won-form.tsx");
const PERSON = read("src/components/v2/person-page.tsx");

const sliceTo = (src: string, from: string, to: string) => {
  const at = src.indexOf(from);
  expect(at).toBeGreaterThan(-1);
  const end = src.indexOf(to, at);
  expect(end).toBeGreaterThan(at);
  return src.slice(at, end);
};

describe("the close-won form", () => {
  it("asks whose win it was, and refuses to send until somebody answers", () => {
    // Defaulting the answer would record words nobody said, which is the one thing the
    // form exists to stop. Two named buttons rather than a checkbox: an unticked box
    // reads as "not ours" without anybody choosing it.
    expect(FORM).toContain("Caused by us?");
    expect(FORM).toContain("useState<boolean | null>(null)");
    expect(FORM).toContain("disabled={cause === null}");
    expect(FORM).toContain("if (cause === null) return;");
  });

  it("is mounted by the person page", () => {
    // A guard on the form alone passes forever over a surface that never renders it.
    expect(PERSON).toContain("<CloseWonForm");
  });
});

describe("the deal-value field opens with the offer's own stated lifetime revenue", () => {
  it("seeds the field ONCE, so it cannot rewrite an amount somebody is typing", () => {
    const form = SECTION.slice(SECTION.indexOf("export function StageStatementForm("));
    expect(form).toContain("useState(() =>");
    expect(form).toContain("defaultValueUsd != null && defaultValueUsd > 0");
  });

  it("is a PREFILL, not a default — what is sent is whatever the field holds", () => {
    // The producer refuses a sale with no value on purpose, and nothing here sends a
    // number on the author's behalf: an empty field still leaves the button disabled.
    const form = SECTION.slice(SECTION.indexOf("export function StageStatementForm("));
    expect(form).toContain("const valueCents = saleValueCentsFrom(rawValue);");
    expect(form).toContain("if (needsValue && valueCents == null) return;");
  });
});
