import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as featureGates from "../src/lib/feature-gates";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

const page = read(
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/api-keys/page.tsx",
);
const sidebar = read("../src/components/context-sidebar.tsx");

/**
 * The org API key page is GA.
 *
 * It shipped behind `alpha-keys`, and `useFeatureFlag` returns `false`
 * unconditionally in the dashboard (alpha/beta live only in admin since the
 * 2026-06-14 split) — so the nav entry was invisible to EVERYONE, staff
 * included, and the page was reachable only by typing its URL. Graduating it
 * means dropping the gate, not widening a PostHog flag.
 */
describe("org API keys — GA, no maturity gate", () => {
  it("carries no feature-gate entry — the registry itself no longer exists", () => {
    // `useFeatureFlag` returned false unconditionally in this app, so a gate hid a
    // surface rather than staging it. Registry and hook are both deleted.
    expect(featureGates).not.toHaveProperty("FEATURE_GATES");
  });

  it("the sidebar entry is ungated and wears no maturity badge", () => {
    const org = sidebar.slice(
      sidebar.indexOf("function OrgLevelSidebar"),
      sidebar.indexOf("const ENTITY_ICON_MAP"),
    );
    expect(org.length).toBeGreaterThan(0);
    expect(org).toMatch(/id:\s*"api-keys"/);
    expect(org).not.toContain('FEATURE_GATES["keys"]');
    expect(org).not.toContain("keysEnabled");
  });

  it("the page itself gates on nothing", () => {
    expect(page).not.toContain("useFeatureFlag");
    expect(page).not.toContain("MaturityBadge");
  });
});

/**
 * One key, one page. BYOK (bring-your-own provider key) was a second section
 * on the same page; it is gone — we hand out our own API key and nothing else.
 */
describe("org API keys — no BYOK surface", () => {
  it("renders no Provider Keys section", () => {
    expect(page).not.toContain("Provider Keys");
    expect(page).not.toContain("BYOK");
    expect(page).not.toContain("Use platform");
  });

  it("reads none of the BYOK / key-source endpoints", () => {
    for (const reader of [
      "listByokKeys",
      "setByokKey",
      "deleteByokKey",
      "listKeySources",
      "setKeySource",
      "listWorkflows",
    ]) {
      expect(page).not.toContain(reader);
    }
  });
});

/**
 * Every install snippet on this page is a command a person pastes. A GA page
 * that hands out commands which 404 is worse than no page at all, so only
 * instructions that actually work survive:
 *
 *  - `@distribute/mcp` and `@distribute/api-client` are NOT published (npm 404).
 *    The MCP repo is `@mcpfactory/mcp-service`, `private: true`, retired brand.
 *  - `X-API-Key` is api-service's ADMIN auth path; an org key sent that way is
 *    rejected with `401 Invalid admin key`. A user key is a Bearer token
 *    (api-service `src/middleware/auth.ts`, path 2).
 */
describe("org API keys — the How-to-use snippets have to work", () => {
  it("authenticates the curl with a Bearer token, not the admin key header", () => {
    expect(page).toContain("Authorization: Bearer");
    expect(page).not.toContain("X-API-Key");
  });

  it("advertises no unpublished npm package", () => {
    expect(page).not.toContain("@distribute/mcp");
    expect(page).not.toContain("@distribute/api-client");
    expect(page).not.toContain("DistributeClient");
  });
});
