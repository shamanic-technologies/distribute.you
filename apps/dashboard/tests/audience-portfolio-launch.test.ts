import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Owner 2026-10-03: the customer validates WHO they sell to (the ICP text); at the
 * launch we start a PORTFOLIO of audiences built from it (the cold split plus the
 * buying-signal audiences that reach enough companies), all active, all screened by
 * Jev against the same target before a contact is paid for. One human-service call,
 * `launchAudiencePortfolio`, from every flow that launches a brand.
 *
 * Source-substring guards (the components import through the `@` alias): the CALL
 * SITES are pinned, since a reader nothing calls is the feature absent.
 */
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const api = read("src/lib/api.ts");
const launch = read("src/components/v2/get-started/launch.ts");
const wall = read("src/components/v2/get-started/account-card-wall.tsx");
const flow = read("src/components/v2/get-started/get-started.tsx");
const snapshot = read("src/lib/v2/get-started.ts");
const modal = read("src/components/v2/new-org-modal.tsx");

describe("launchAudiencePortfolio", () => {
  const fn = api.slice(api.indexOf("export async function launchAudiencePortfolio("), api.indexOf("export interface AudienceWire {"));

  it("posts brand, offer and the ICP text to the portfolio route", () => {
    expect(fn).toContain("`/orgs/audiences/portfolio`");
    expect(fn).toContain('method: "POST"');
    expect(fn).toContain("body: { brandId, offerId, targetAudience }");
  });

  it("fails loud on a bad shape and on an empty portfolio", () => {
    expect(fn).toContain("LaunchAudiencePortfolioResponseSchema.safeParse(raw)");
    expect(fn).toContain("parsed.data.audiences.length === 0");
  });
});

describe("/get-started launches the portfolio, not the one audience picked in the preview", () => {
  const block = launch.slice(launch.indexOf("if (!progress.audiences) {"), launch.indexOf("if (input.plan.length === 0)"));

  it("calls the portfolio with the ICP text and no longer demotes the other audiences", () => {
    expect(block).toContain("await launchAudiencePortfolio(input.brandId, offerId, targetAudience);");
    expect(launch).not.toContain("setAudienceStatus");
    expect(launch).not.toContain("input.audienceId");
  });

  it("refuses to launch with no ICP text", () => {
    expect(block.indexOf("if (!targetAudience)")).toBeGreaterThan(-1);
    expect(block.indexOf("if (!targetAudience)")).toBeLessThan(block.indexOf("await launchAudiencePortfolio("));
  });

  it("carries the ICP text through the Google round trip to the wall", () => {
    expect(snapshot).toContain("icp?: string | null;");
    expect(snapshot).toContain('icp: typeof s.icp === "string" && s.icp.trim() ? s.icp : null,');
    expect(flow).toContain("saveSnapshot({ icp });");
    expect(flow).toContain("if (s.icp) icpRef.current = s.icp;");
    expect(flow).toContain("targetAudience={icpRef.current}");
    expect(wall).toContain("{ brandId, website, offer, targetAudience, budgetUsd, plan, answered }");
  });
});

describe("the Add-a-brand modal launches the portfolio over the segments it confirmed", () => {
  it("confirms the picked segments, then launches the portfolio on the same text", () => {
    const confirm = modal.indexOf("await confirmAudienceSegments(id, chosenOffer, audienceText.trim()");
    const portfolio = modal.indexOf("await launchAudiencePortfolio(id, chosenOffer, audienceText.trim());");
    expect(confirm).toBeGreaterThan(-1);
    expect(portfolio).toBeGreaterThan(confirm);
  });
});
