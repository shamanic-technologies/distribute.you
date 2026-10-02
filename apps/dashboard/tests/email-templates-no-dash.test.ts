import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { EMAIL_TEMPLATES } from "../src/instrumentation";

// Owner rule: no em dash (U+2014) or en dash (U+2013) in anything a client reads.
// Every template this app registers is checked, subject AND both bodies, so a new
// template cannot bring one back. The outcome digest composes part of its body at
// send time, so its source is scanned too (comments stripped).
const DASH = /[—–]/;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("no em/en dash in registered email templates", () => {
  for (const t of EMAIL_TEMPLATES) {
    it(`"${t.name}" has no dash in subject, html or text`, () => {
      expect(t.subject).not.toMatch(DASH);
      expect(t.htmlBody).not.toMatch(DASH);
      expect(t.textBody).not.toMatch(DASH);
    });
  }

  it("the outcome digest's send-time body has no dash", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/lib/outcome-digest.ts"), "utf-8");
    expect(stripComments(src)).not.toMatch(DASH);
  });
});

describe("out-of-credit dunning family", () => {
  const names = [
    "credit-depleted",
    "credit-depleted-followup-3d",
    "credit-depleted-followup-10d",
    "credit-depleted-blocked",
    "credit-depleted-followup-3d-blocked",
    "credit-depleted-followup-10d-blocked",
  ];
  const family = EMAIL_TEMPLATES.filter((t) => t.name.startsWith("credit-depleted"));

  it("registers all six, each once (byte-equal to billing-service's eventTypes)", () => {
    expect(family.map((t) => t.name).sort()).toEqual([...names].sort());
  });

  // A balance used up is a success moment, never a shortage (owner, 2026-10-01).
  const SHORTAGE = /ran out|run out|out of credit|stopped|exhausted|depleted|paused|nothing is lost/i;
  for (const name of names) {
    it(`"${name}" frames the moment as a success with one button`, () => {
      const t = family.find((x) => x.name === name)!;
      expect(t.subject).not.toMatch(SHORTAGE);
      expect(t.textBody).not.toMatch(SHORTAGE);
      expect(t.htmlBody.replace(/<[^>]+>/g, "")).not.toMatch(SHORTAGE);
      expect(t.htmlBody.match(/display:inline-block;background:/g)).toHaveLength(1);
    });
  }

  it("auto top-up is offered only where the card can be charged off session", () => {
    for (const t of family) {
      if (t.name.endsWith("-blocked")) {
        expect(t.textBody).not.toContain("Turn on auto top-up");
        expect(t.textBody).toContain("Your bank doesn't allow automatic top-ups");
      } else {
        expect(t.textBody).toContain("Turn on auto top-up");
      }
    }
  });
});
