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

  it("breadcrumb handleOrgSwitch navigates via router.push, no imperative setActive", () => {
    const src = readFileSync(resolve(ROOT, "src/components/breadcrumb-nav.tsx"), "utf8");
    const handlerMatch = src.match(/const handleOrgSwitch[\s\S]*?\n\s*\};/);
    expect(handlerMatch, "handleOrgSwitch handler not found").toBeTruthy();
    const handler = handlerMatch![0];
    expect(handler).toMatch(/router\.push\(`\/orgs\/\$\{[^}]+\}`\)/);
    expect(handler).not.toContain("setActive(");
  });
});
