import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Emptying a user-field must actually clear it. brand-service replaces the value of
// every key the PUT carries and leaves an OMITTED key untouched, and a key with no
// confirmed row falls back to the AI `suggested` prefill on the next read. Omitting
// empty values therefore made a deletion impossible: the entry came back on the next
// read. Both dashboard surfaces that write these fields are guarded here.

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

function sliceFn(src: string, marker: string): string {
  const start = src.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, start + 1200);
}

// The exact guard that dropped an emptied value on the floor.
const DROPS_EMPTY = "if (cleaned.length) out[key] = cleaned;";

describe("Strategy page — profileToUserFieldsPayload", () => {
  const fn = sliceFn(
    read("../src/components/strategy/strategy-page.tsx"),
    "function profileToUserFieldsPayload",
  );

  it("assigns every one of the 7 keys unconditionally", () => {
    expect(fn).toContain("out[key] =");
    expect(fn).not.toContain(DROPS_EMPTY);
  });

  it("splits list vs text off the shared field defs", () => {
    expect(fn).toContain('ALL_FIELDS.find((f) => f.key === key)?.kind === "list"');
    expect(fn).toContain(': ""');
  });
});

describe("onboarding — buildUserFieldsPayload", () => {
  const fn = sliceFn(
    read("../src/components/onboarding/onboarding.tsx"),
    "function buildUserFieldsPayload",
  );

  it("gates on presence in the bag, not on a non-empty value", () => {
    expect(fn).toContain("if (!(key in profile)) continue;");
    expect(fn).not.toContain(DROPS_EMPTY);
    expect(fn).toContain("out[key] =");
  });

  it("keeps the non-empty guard on services only", () => {
    // services is the services step's own picked list; an empty one there is not a
    // deletion, it is a step the user has not completed.
    expect(fn).toContain("if (cleanServices.length) out.services = cleanServices;");
  });
});
