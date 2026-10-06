import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseLifetimeRevenue } from "../src/lib/v2/get-started";

/**
 * Onboarding step "What a client is worth": the lifetime revenue is mandatory, so
 * Continue (button and Enter) stays shut until the field holds a valid amount.
 */
describe("lifetime revenue is required to move on", () => {
  it("refuses an empty, non-numeric or zero amount", () => {
    expect("problem" in parseLifetimeRevenue("")).toBe(true);
    expect("problem" in parseLifetimeRevenue("  ")).toBe(true);
    expect("problem" in parseLifetimeRevenue("abc")).toBe(true);
    expect("problem" in parseLifetimeRevenue("0")).toBe(true);
    expect(parseLifetimeRevenue("$5,000")).toEqual({ usd: 5000 });
  });

  it("disables Continue and Enter while the amount is not valid", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    const at = src.indexOf("function ValueStage(");
    const stage = src.slice(at, src.indexOf("function EditableAnswer(", at));
    expect(stage).toContain('const hasValue = !("problem" in parseLifetimeRevenue(value));');
    expect(stage).toContain("disabled={busy || !hasValue}");
    expect(stage).toContain('e.key === "Enter" && !done && hasValue');
  });
});
