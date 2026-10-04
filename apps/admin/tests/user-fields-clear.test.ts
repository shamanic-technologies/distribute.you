import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Emptying a user-field must actually clear it. brand-service replaces the value of
// every key the PUT carries and leaves an OMITTED key untouched, and a key with no
// confirmed row falls back to the AI `suggested` prefill on the next read. So the old
// "omit empty values" behaviour made a deletion impossible: the entry came straight
// back on the next read.
//
// Source-substring guards rather than unit calls: these modules import through the
// `@` alias, which vitest does not resolve here.

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

function sliceFn(src: string, marker: string): string {
  const start = src.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, start + 1200);
}

// The exact guard that dropped an emptied value on the floor.
const DROPS_EMPTY = "if (cleaned.length) out[key] = cleaned;";

describe("admin Brand Settings — profileToPayload", () => {
  const fn = sliceFn(read("../src/lib/user-fields-form.ts"), "export function profileToPayload");

  it("assigns every key of the subset unconditionally", () => {
    expect(fn).toContain("out[key] =");
    expect(fn).not.toContain(DROPS_EMPTY);
  });

  it("emits [] for an emptied list and \"\" for an emptied text field", () => {
    expect(fn).toContain('f.kind === "list"');
    expect(fn).toContain("coerceListField(v)");
    expect(fn).toContain('v.trim()');
    expect(fn).toContain(': ""');
  });
});

// The dashboard Strategy page (retired in #3284) and the dashboard v1 onboarding
// wizard (deleted 2026-10-04) carried the other copies of this builder; this console's
// is the one left here.
