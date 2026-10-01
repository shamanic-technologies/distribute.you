import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A lead's campaign cards come from lead-service (`include=campaigns`), never from
 * grouping brand-scoped rows (one row per person, so grouping draws one card however
 * many campaigns the person is in).
 */
const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");

describe("the cards come from lead-service, never from grouping rows", () => {
  it("asks for them — a read that does not ask carries no key at all", () => {
    expect(api).toContain('const LEADS_INCLUDE = "campaigns"');
    // BOTH readers: the panel is the same component at every grain.
    expect(api).toContain("`/leads?campaignId=${campaignId}&view=basic&include=${LEADS_INCLUDE}`");
    expect(api).toContain("`/leads?brandId=${brandId}&view=basic&include=${LEADS_INCLUDE}`");
  });

  // Opt-in, so a read that does not ask is byte-identical. Not `.optional()` because the
  // producer might omit it.
  it("types the field as the opt-in extra it is", () => {
    expect(api).toContain("campaigns?: LeadCampaignEvidence[];");
    expect(api).toContain("delivery: LeadCampaignDelivery | null;");
  });
});
