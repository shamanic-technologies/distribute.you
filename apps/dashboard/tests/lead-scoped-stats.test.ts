import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const apiContent = read("src/lib/api.ts");
const funnelContent = read("src/components/campaign/funnel-metrics.tsx");
const replyContent = read("src/components/campaign/reply-breakdown.tsx");
const panelRel = "src/components/campaign/leads-stats-panel.tsx";
const leadsPageRel =
  "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/leads/page.tsx";

describe("api.ts — deprecated apollo stats removed", () => {
  it("does not export ApolloStats interface", () => {
    expect(apiContent).not.toMatch(/export interface ApolloStats\b/);
  });

  it("does not declare apollo? field on CampaignStats", () => {
    const cs = apiContent.match(/export interface CampaignStats[\s\S]*?^}/m);
    expect(cs, "CampaignStats interface not found").toBeTruthy();
    expect(cs![0]).not.toMatch(/\bapollo\?:/);
  });
});

describe("Generic stats renderers — registry-driven, no hardcoded metric keys", () => {
  it("funnel-metrics has no hardcoded lead/recipient stat key literals", () => {
    const forbidden = [
      "'served'",
      '"served"',
      "'contacted'",
      '"contacted"',
      "'apollo'",
      '"apollo"',
      "'leadsServed'",
      '"leadsServed"',
      "'repliesPositive'",
      '"repliesPositive"',
    ];
    for (const lit of forbidden) {
      expect(funnelContent, `funnel-metrics contains forbidden literal ${lit}`).not.toContain(lit);
    }
  });

  it("reply-breakdown has no hardcoded reply stat key literals", () => {
    const forbidden = [
      "'repliesPositive'",
      '"repliesPositive"',
      "'repliesNegative'",
      '"repliesNegative"',
      "'repliesNeutral'",
      '"repliesNeutral"',
      "'repliesAutoReply'",
      '"repliesAutoReply"',
    ];
    for (const lit of forbidden) {
      expect(replyContent, `reply-breakdown contains forbidden literal ${lit}`).not.toContain(lit);
    }
  });
});

describe("LeadsStatsPanel — exists and is registry-driven", () => {
  const panelContent = (() => {
    try {
      return read(panelRel);
    } catch {
      return null;
    }
  })();

  it("file exists at components/campaign/leads-stats-panel.tsx", () => {
    expect(panelContent, "leads-stats-panel.tsx not found").not.toBeNull();
  });

  it("named-exports LeadsStatsPanel", () => {
    expect(panelContent!).toMatch(/export function LeadsStatsPanel\b/);
  });

  it("uses formatStatValue (registry-driven formatting, not hand-rolled)", () => {
    expect(panelContent!).toContain("formatStatValue");
  });

  it("reads registry from useFeatures (not a private map)", () => {
    expect(panelContent!).toMatch(/from\s+["']@\/lib\/features-context["']/);
    expect(panelContent!).toContain("useFeatures(");
  });

  it("fetches stats via fetchFeatureStats with campaignId scope", () => {
    expect(panelContent!).toContain("fetchFeatureStats");
    expect(panelContent!).toContain("campaignId");
  });

  it("references the new lead-scoped pipeline keys", () => {
    for (const key of ["leadsClaimed", "leadsBuffered", "leadsSkipped"]) {
      expect(panelContent!, `missing ${key}`).toContain(key);
    }
  });

  it("references the new lead-scoped outreach keys", () => {
    for (const key of [
      "leadsContacted",
      "leadsDelivered",
      "leadsOpened",
      "leadsClicked",
      "leadsBounced",
      "leadsUnsubscribed",
    ]) {
      expect(panelContent!, `missing ${key}`).toContain(key);
    }
  });

  it("references the four aggregate reply keys", () => {
    for (const key of [
      "leadsRepliesPositive",
      "leadsRepliesNegative",
      "leadsRepliesNeutral",
      "leadsRepliesAutoReply",
    ]) {
      expect(panelContent!, `missing ${key}`).toContain(key);
    }
  });

  it("references the granular reply detail keys", () => {
    for (const key of [
      "leadsRepliesInterested",
      "leadsRepliesMeetingBooked",
      "leadsRepliesClosed",
      "leadsRepliesNotInterested",
      "leadsRepliesWrongPerson",
      "leadsRepliesUnsubscribeDetail",
      "leadsRepliesNeutralDetail",
      "leadsRepliesAutoReplyDetail",
      "leadsRepliesOutOfOffice",
    ]) {
      expect(panelContent!, `missing ${key}`).toContain(key);
    }
  });

  it("references lead-scoped rate keys", () => {
    for (const key of ["leadOpenRate", "leadClickRate", "leadPositiveReplyRate"]) {
      expect(panelContent!, `missing ${key}`).toContain(key);
    }
  });

  it("references lead-scoped cost-per keys", () => {
    for (const key of [
      "costPerLeadOpenCents",
      "costPerLeadClickCents",
      "costPerLeadPositiveReplyCents",
    ]) {
      expect(panelContent!, `missing ${key}`).toContain(key);
    }
  });
});

describe("Campaign leads page mounts LeadsStatsPanel", () => {
  const leadsPage = read(leadsPageRel);

  it("imports LeadsStatsPanel", () => {
    expect(leadsPage).toMatch(
      /import\s*\{\s*LeadsStatsPanel\s*\}\s*from\s*["']@\/components\/campaign\/leads-stats-panel["']/,
    );
  });

  it("renders <LeadsStatsPanel /> in JSX", () => {
    expect(leadsPage).toMatch(/<LeadsStatsPanel\b/);
  });
});
