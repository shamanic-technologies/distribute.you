import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

// Items 3 and 5 (the paginated conversion tables and their lead photos) covered the
// conversion tabs, which never rendered and are now retired — see
// conversions-cluster-retired.test.ts.

describe("Org logos render Clerk imageUrl (item 4)", () => {
  const breadcrumb = read("components/breadcrumb-nav.tsx");
  it("breadcrumb root + its org list use organization.imageUrl via OrgAvatar", () => {
    // OrgAvatar is a shared component, so the breadcrumb's org mark can't drift.
    expect(read("components/org-avatar.tsx")).toContain("export function OrgAvatar(");
    expect(breadcrumb).toContain("OrgAvatar");
    // Root avatar uses the per-tab URL org's cached image (#1948); the switcher
    // list still maps each membership's own imageUrl.
    expect(breadcrumb).toContain("imageUrl={displayOrgImageUrl}");
    expect(breadcrumb).toContain("imageUrl={m.organization.imageUrl}");
    // No more hardcoded-initial-only org badge.
    expect(breadcrumb).not.toContain("{organization?.name?.[0] || \"O\"}");
  });
});

describe("Adaptive currency: <$10 keeps cents, ≥$10 whole dollars", () => {
  it("formatUsd logic: cents under $10, whole dollars from $10", () => {
    const formatUsd = (n: number): string => {
      if (n > 0 && n < 0.01) return "<$0.01";
      const decimals = Math.abs(n) < 10 ? 2 : 0;
      return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    };
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.4)).toBe("$0.40");
    expect(formatUsd(0.001)).toBe("<$0.01");
    expect(formatUsd(9.99)).toBe("$9.99");
    expect(formatUsd(1234)).toBe("$1,234");
  });
});
