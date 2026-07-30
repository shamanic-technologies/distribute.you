import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The "Last used" pill sits over the top edge of the auth method it labels. Both
 * Google buttons carry `hover:brightness-[0.97]`, and a non-none CSS filter turns
 * the button into its own stacking context — which promotes it into the same paint
 * layer as the absolutely-positioned pill, later in DOM order. Without an explicit
 * z-index on the pill the button therefore paints OVER it on hover only.
 *
 * Source-substring guards: the component carries no runtime `@` import but the app
 * ships no jsdom/testing-library, so the paint order itself is verified with a
 * Playwright elementFromPoint probe rather than a unit render.
 */
describe("Last used badge stacking", () => {
  const badgePath = path.join(
    __dirname,
    "../src/components/auth/last-used-badge.tsx"
  );
  const badge = fs.readFileSync(badgePath, "utf-8");

  const signInPath = path.join(
    __dirname,
    "../src/app/(authed)/sign-in/[[...sign-in]]/page.tsx"
  );
  const signUpPath = path.join(
    __dirname,
    "../src/app/(authed)/sign-up/[[...sign-up]]/page.tsx"
  );
  const signIn = fs.readFileSync(signInPath, "utf-8");
  const signUp = fs.readFileSync(signUpPath, "utf-8");

  it("keeps an explicit z-index so a hover filter cannot paint over the pill", () => {
    expect(badge).toContain("zIndex: 1");
  });

  it("keeps the pill absolutely positioned against its wrapper", () => {
    expect(badge).toContain('position: "absolute"');
  });

  it("documents why the z-index is load-bearing", () => {
    expect(badge).toContain("filter");
    expect(badge).toContain("stacking context");
  });

  it("anchors every badge in a relatively-positioned wrapper", () => {
    for (const src of [signIn, signUp]) {
      const badges = src.match(/<LastUsedBadge/g) ?? [];
      const wrappers = src.match(/position: "relative"/g) ?? [];
      expect(badges.length).toBe(2);
      expect(wrappers.length).toBeGreaterThanOrEqual(badges.length);
    }
  });
});
