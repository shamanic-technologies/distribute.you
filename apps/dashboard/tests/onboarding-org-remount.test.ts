import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Creating a NEW org from the dashboard used to bounce the user back a step.
 *
 * `/onboarding?new=1&from=add` → type a URL → "Analyze my product" → the loading
 * screen → and then the URL step again, with the brand silently created in an org
 * the user never reached. The cause was not in the flow at all: `createBrandAndFetchServices`
 * calls Clerk `createOrganization` + `setActive` while the loading screen is up, so
 * `useOrganization()` returns a brand-new id. `QueryProvider` keyed its inner provider
 * on that id, so the whole onboarding subtree REMOUNTED — every `useState` reset, and
 * the persisted snapshot (step `"loading"`, no brandId yet) resolved back to `"url"`.
 * The in-flight create kept running in the detached closure, which is why prod ended up
 * with one `claude.ai` brand linked to three orgs from three attempts.
 *
 * The `?from=add` path (new brand in the EXISTING org) never hit this: it reuses the
 * active org, so nothing flips.
 *
 * Source-substring guards (the dashboard convention) — `query-provider.tsx` imports
 * through the `@` alias, which vitest does not resolve here, so it is not runtime-importable.
 */
describe("Onboarding survives the org it creates", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const queryProviderPath = "src/lib/query-provider.tsx";
  const onboardingLayoutPath = "src/app/(authed)/onboarding/layout.tsx";

  it("the onboarding layout declares the scope that opts out of org keying", () => {
    // Declared by the layout, not sniffed from the pathname: `usePathname` updates
    // while the router navigates away at the end of the flow, which would flip the
    // key and remount the wizard one last time on its way out.
    const content = read(onboardingLayoutPath);
    expect(content).toContain('<QueryProvider scope="onboarding">');
  });

  it("QueryProvider keeps ONE key for the whole onboarding flow", () => {
    const content = read(queryProviderPath);
    expect(content).toContain('scope?: "onboarding"');
    expect(content).toContain('const isOnboarding = scope === "onboarding"');
    expect(content).toContain('isOnboarding ? "onboarding"');
    expect(content).toContain(': stableOrgId ?? "no-org"');
  });

  it("onboarding runs on an in-memory cache — no writes under the previous org's prefix", () => {
    // The persister is org-prefixed. Holding the PREVIOUS org's id across the switch
    // would file queries fetched for the NEW org under the old org's disk key space —
    // the cross-org bleed the prefix exists to prevent (DIS-143). Null disables
    // persistence outright, which is what `persistEnabled` already expects.
    const content = read(queryProviderPath);
    expect(content).toContain("isOnboarding ? null : stableOrgId");
    expect(content).toContain("orgId={scopedOrgId}");
  });

  it("the dashboard provider still keys on the org (isolation is unchanged)", () => {
    // The opt-out is scoped to onboarding only: every other mount keeps the keyed
    // remount that gives each org a fresh in-memory cache + disk prefix.
    const content = read(queryProviderPath);
    expect(content).toContain("urlOrgId ?? organization?.id");
    expect(content).toContain("key={orgKey}");
  });
});
