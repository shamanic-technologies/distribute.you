import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");

describe("Clerk org/URL sync guards", () => {
  it("proxy.ts wires organizationSyncOptions so URL [orgId] drives Clerk active org", () => {
    const src = readFileSync(resolve(ROOT, "src/proxy.ts"), "utf8");
    expect(src).toContain("organizationSyncOptions");
    expect(src).toMatch(/organizationPatterns\s*:\s*\[\s*['"]\/orgs\/:id['"]\s*,\s*['"]\/orgs\/:id\/\(\.\*\)['"]\s*\]/);
  });

  it("breadcrumb handleOrgSwitch calls BOTH setActive and router.push to prevent client/URL drift", () => {
    const src = readFileSync(resolve(ROOT, "src/components/breadcrumb-nav.tsx"), "utf8");
    const handlerMatch = src.match(/const handleOrgSwitch[\s\S]*?\n\s*\};/);
    expect(handlerMatch, "handleOrgSwitch handler not found").toBeTruthy();
    const handler = handlerMatch![0];
    // router.push updates the URL so middleware's organizationSyncOptions confirms server-side
    expect(handler).toMatch(/router\.push\(`\/orgs\/\$\{[^}]+\}`\)/);
    // setActive updates Clerk's client-side active org immediately so useOrganization()
    // reflects the new org without waiting for a session cookie refresh round-trip
    expect(handler).toMatch(/setActive\(\s*\{\s*organization\s*:/);
  });
});
