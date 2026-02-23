import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the global QueryProvider had refetchInterval: 5000 which caused
 * every query in the app to poll, triggering full page re-renders every 5s.
 * Polling must only be set on specific queries that need it (e.g. campaign context).
 */
describe("Campaign polling does not cause full page reload", () => {
  const queryProviderPath = path.join(
    __dirname,
    "../src/lib/query-provider.tsx"
  );
  const campaignContextPath = path.join(
    __dirname,
    "../src/lib/campaign-context.tsx"
  );

  it("QueryProvider should NOT set a global refetchInterval", () => {
    const content = fs.readFileSync(queryProviderPath, "utf-8");
    expect(content).not.toMatch(/refetchInterval/);
  });

  it("CampaignProvider should set refetchInterval on its queries", () => {
    const content = fs.readFileSync(campaignContextPath, "utf-8");
    expect(content).toMatch(/refetchInterval/);
  });

  it("CampaignProvider should memoize context value to prevent re-renders", () => {
    const content = fs.readFileSync(campaignContextPath, "utf-8");
    expect(content).toMatch(/useMemo/);
  });
});
