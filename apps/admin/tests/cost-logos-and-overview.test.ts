import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { MATURITY_STYLES } from "../src/lib/feature-gates";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

describe("org overview — Recent Campaigns removed", () => {
  const page = read("../src/app/(authed)/(dashboard)/orgs/[orgId]/page.tsx");

  it("has no Recent Campaigns section", () => {
    expect(page).not.toMatch(/Recent Campaigns/);
    expect(page).not.toMatch(/recentCampaigns/);
  });

  it("no longer fetches campaigns", () => {
    expect(page).not.toMatch(/listCampaigns/);
  });
});

describe("cost breakdown — provider logos", () => {
  const usage = read("../src/components/org-usage.tsx");
  const providerLogo = read("../src/components/provider-logo.tsx");

  it("joins cost names against the backend platform-price catalog", () => {
    expect(usage).toMatch(/getPlatformPrices/);
    expect(usage).toMatch(/providerDomain/);
    expect(usage).toMatch(/ProviderLogo/);
  });

  it("ProviderLogo uses logo.dev and renders nothing without a domain (no letter fallback)", () => {
    expect(providerLogo).toMatch(/img\.logo\.dev/);
    expect(providerLogo).toMatch(/return null/);
  });
});

describe("alpha badge contrast", () => {
  it("alpha uses a saturated amber fill, not the pale amber-100", () => {
    expect(MATURITY_STYLES.alpha).toContain("amber-400");
    expect(MATURITY_STYLES.alpha).not.toContain("amber-100");
  });
});
