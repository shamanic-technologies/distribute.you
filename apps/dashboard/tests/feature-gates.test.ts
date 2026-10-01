import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as featureGates from "../src/lib/feature-gates";
import { MATURITY_STYLES, GA_BRAND_FEATURES } from "../src/lib/feature-gates";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

/**
 * There is no alpha gating in the dashboard, and there must not be one again.
 *
 * `useFeatureFlag` returned `false` unconditionally in this app since the
 * admin/dashboard split, so a gate did not STAGE a surface — it REMOVED it: the nav
 * entry rendered for nobody and the page was reachable only by typing a URL. Brand
 * Info, Workflows and the Google CRM console lived that way for months before being
 * deleted; all three exist in `apps/admin`, where the flag resolves. A dashboard
 * surface that needs a limited audience uses the EMAIL allowlist, which evaluates.
 */
describe("no alpha gating in the dashboard", () => {
  it("the FEATURE_GATES registry is gone", () => {
    expect(featureGates).not.toHaveProperty("FEATURE_GATES");
  });

  it("the useFeatureFlag hook is gone — the file itself must not come back", () => {
    expect(fs.existsSync(path.join(__dirname, "../src/lib/use-feature-flag.ts"))).toBe(false);
  });

  // Match the CALL, not the bare word: several files legitimately EXPLAIN in a
  // comment why this app has no flag gating, and a guard that trips on its own
  // rationale is the source-substring trap this repo keeps recording.
  it("nothing under src calls useFeatureFlag", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && fs.readFileSync(full, "utf-8").includes("useFeatureFlag("))
          offenders.push(path.relative(path.join(__dirname, "../src"), full));
      }
    };
    walk(path.join(__dirname, "../src"));
    expect(offenders).toEqual([]);
  });

  it("the surfaces those gates hid are DELETED, not left URL-reachable", () => {
    for (const dead of [
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info",
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows",
      "app/(authed)/(dashboard)/workflows",
      "app/(authed)/(dashboard)/orgs/[orgId]/services",
      // NOT `components/workflows`: the campaign-level Workflows surface lives
      // there and is gated on the EMAIL allowlist, which actually evaluates. What
      // was deleted is the ALPHA-gated BRAND workflow editor, whose routes are
      // still asserted absent above.
    ]) {
      expect(fs.existsSync(path.join(__dirname, "../src", dead)), dead).toBe(false);
    }
  });

  it("keeps only the Google OAuth callback under the old services tree", () => {
    // The alpha services surface is gone. One path under it is not ours to move:
    // `/services/crm/oauth/callback` is the redirect URI registered on the Google
    // OAuth client, so the Gmail connect round trip must land exactly there.
    const root = path.join(__dirname, "../src/app/(authed)/services");
    const files = (fs.readdirSync(root, { recursive: true }) as string[])
      .filter((f) => fs.statSync(path.join(root, f)).isFile())
      .map((f) => f.split(path.sep).join("/"));
    expect(files).toEqual(["crm/oauth/callback/page.tsx"]);
  });
});

describe("GA_BRAND_FEATURES — brand-page GA exceptions", () => {
  it("contains only sales cold-email (pr cold-email is alpha-gated)", () => {
    expect(GA_BRAND_FEATURES.has("sales-cold-email-outreach")).toBe(true);
    expect(GA_BRAND_FEATURES.has("pr-cold-email-outreach")).toBe(false);
    expect(GA_BRAND_FEATURES.size).toBe(1);
  });
});

describe("MaturityBadge styles", () => {
  it("alpha = amber, beta = violet", () => {
    expect(MATURITY_STYLES.alpha).toContain("amber");
    expect(MATURITY_STYLES.beta).toContain("violet");
  });
});
