import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");

describe("Clerk org/URL sync guards", () => {
  it("proxy.ts wires organizationSyncOptions so URL [orgId] drives Clerk active org", () => {
    const src = readFileSync(resolve(ROOT, "src/proxy.ts"), "utf8");
    expect(src).toContain("organizationSyncOptions");
    // v1 URLs first, then the same two shapes under the v2 dashboard prefix — the
    // URL org drives Clerk's active org in both trees.
    expect(src).toMatch(/organizationPatterns\s*:\s*\[\s*['"]\/orgs\/:id['"]\s*,\s*['"]\/orgs\/:id\/\(\.\*\)['"]\s*,\s*['"]\/v2\/orgs\/:id['"]\s*,\s*['"]\/v2\/orgs\/:id\/\(\.\*\)['"]\s*\]/);
  });

  it("handleOrgSwitch loads the target org's URL so organizationSyncOptions activates it", () => {
    // Lives in the shared tenant-switch hook — consumed by BOTH the pre-beta
    // breadcrumb and the beta sidebar switcher, so there is one implementation.
    const src = readFileSync(resolve(ROOT, "src/lib/use-tenant-switcher.ts"), "utf8");
    const handlerMatch = src.match(/const handleOrgSwitch[\s\S]*?\n\s*\}, \[/);
    expect(handlerMatch, "handleOrgSwitch handler not found").toBeTruthy();
    const handler = handlerMatch![0];
    // A FULL load: the middleware's organizationSyncOptions activates the URL org
    // server-side before the page renders, so the page boots under the new org. An
    // in-page setActive hung in prod (2026-10-13) and left the token on the target
    // org while the page stayed on the old one.
    expect(handler).toMatch(/window\.location\.assign\(`\/orgs\/\$\{[^}]+\}`\)/);
    expect(handler).not.toMatch(/setActive\(/);
  });
});
