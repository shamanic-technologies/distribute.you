import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The lead panel is about a PERSON, and everything a campaign decided about them sits
 * under that campaign: its offer, its audience, and its own timeline.
 *
 * Source-substring, because both files pull Clerk/api through the `@` alias vitest does
 * not resolve here. The MODEL under them is alias-free and carries real unit tests in
 * `lead-campaign-tree.test.ts`; these guards pin the CALL SITES, since a tree the page
 * never renders is the feature entirely absent with the model perfectly correct.
 */
const page = readFileSync(
  join(process.cwd(), "src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);
const sections = readFileSync(
  join(process.cwd(), "src/components/audiences/lead-campaign-sections.tsx"),
  "utf8",
);
const tree = readFileSync(join(process.cwd(), "src/lib/lead-campaign-tree.ts"), "utf8");
const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");

describe("the cards come from lead-service, never from grouping rows", () => {
  // THE bug this replaced: a brand-scoped read answers ONE ROW PER PERSON
  // (`DISTINCT ON (lead_id)`), so grouping rows draws one card however many campaigns
  // the person is really in. The database holds 11 for one sampled person; the endpoint
  // returns 1. Nothing goes red when you get this wrong — the panel simply shows one
  // card and looks correct.
  it("builds the tree from the served cards", () => {
    expect(page).toContain("buildLeadCampaignTree(selectedLead?.campaigns ?? [], campaignInfoOf)");
    // No client-side person grouping: that is what could not work.
    expect(page).not.toContain("dedupeLeadRowsByPerson");
    expect(page).not.toContain("rowsByPerson");
    expect(tree).not.toContain("leadPersonKey");
  });

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

describe("the panel nests a person's campaigns", () => {
  // A campaign reads the same here as in the Campaigns table and the budget modal. A
  // second spelling of what a campaign is called is how two surfaces come to disagree.
  it("names each campaign through the shared identity component", () => {
    expect(sections).toContain(
      'import { CampaignIdentity } from "@/components/campaigns/campaign-identity"',
    );
    expect(sections).toContain("<CampaignIdentity");
  });

  // The campaigns read is the key `useCampaignRows` already polls, so nesting the
  // panel costs no request. Its OWN rows are feature-filtered and identity-collapsed,
  // which would drop the campaigns on other channels and the stopped ancestors this
  // person really was contacted by.
  it("reads every campaign of the brand off the key the page already polls", () => {
    expect(page).toContain('["campaigns", brandId]');
    expect(page).toContain("listCampaignsByBrand(brandId)");
  });

  // A card carries an audience ID only; the resolved name and avatar ride the ROW, and
  // only for the campaign that row represents.
  it("resolves each card's audience without dropping one it cannot name", () => {
    expect(page).toContain("const audienceForCard = useCallback(");
    expect(page).toContain("selectedLead?.audience?.id === card.audienceId");
    expect(sections).toContain("An audience no longer listed");
  });
});

describe("the timeline is lead-service's answer, not a merge done here", () => {
  // The panel used to assemble a person's history in the BROWSER out of six services,
  // with the customer's own mailbox read by nobody. lead-service assembles it now and
  // the panel draws what it sends.
  it("reads the history per card and renders it", () => {
    expect(page).toContain('["leadHistory", openHistoryRowId ?? "none", brandId, "campaign"]');
    expect(page).toContain('getLeadHistory(openHistoryRowId as string, { brandId, scope: "campaign" })');
    expect(page).toContain("<LeadHistoryTimeline");
  });

  // A panel listing eleven campaigns must not fire eleven of these, so only the open
  // card is read for and only the open card can draw one.
  it("reads for the OPEN card alone", () => {
    expect(page).toContain("const openHistoryRowId = panelScope.sole?.rowId ?? openCampaignRowId;");
    expect(page).toContain("node.rowId === openCampaignRowId && openHistory ? (");
  });

  // "We could not read this" and "nothing happened" are different facts, and the read
  // is reveal-on-settle: a failure says so rather than skeletoning forever.
  it("states a failed read rather than an empty history", () => {
    expect(page).toContain("We could not read this person's history right now.");
    expect(page).toContain("We could not read this campaign's history right now.");
  });

  // The roll-up is asked of the producer under its own scope, never added up here.
  it("asks the producer for the brand roll-up", () => {
    expect(page).toContain('{ brandId, scope: "brand" }');
    expect(page).toContain("leadCampaignTree.campaignCount !== 1 && brandHistory && (");
  });

  // The merge is DELETED, not merely unused: leaving it is how a second, disagreeing
  // history comes back.
  it("keeps no second implementation of a timeline", () => {
    expect(page).not.toContain("function LeadTimeline(");
    expect(page).not.toContain("interface TimelineDelivery {");
    expect(page).not.toContain("function deriveEmailRows(");
    expect(page).not.toContain("getLeadEmail(");
    expect(page).not.toContain("getLeadConversation(");
  });
});

describe("one card is open at a time", () => {
  // The open card is what the page fetches an email for, so several open cards are
  // several requests for a panel nobody has finished reading — and eleven timelines
  // stacked in a 480px sheet is a wall rather than an answer.
  it("opens the first card by default and toggles the rest", () => {
    expect(page).toContain("firstCampaignRowId(leadCampaignTree)");
    expect(page).toContain("const toggleCampaign = useCallback(");
    expect(sections).toContain("openRowId === node.rowId");
  });

  // Latched on the lead's identity: a poll must not re-open a card the reader closed,
  // and a freshly opened lead must not inherit the previous one's open row.
  it("scopes the open card to the lead it belongs to", () => {
    expect(page).toContain("openCampaign?.leadRowId === selectedLead.id");
  });

  // The open body contains its own links, and a nested interactive element inside a
  // button is invalid HTML — the same reason the Sales Funnels settings card does it
  // this way. With ONE campaign there is nothing to switch between, so it is not a
  // control at all.
  it("uses a role=button header, keyboard-operable, only when there is a choice", () => {
    expect(sections).toContain('role="button"');
    expect(sections).not.toContain("<button");
    expect(sections).toContain('e.key === "Enter" || e.key === " "');
    expect(sections).toContain("collapsible ? (");
  });
});

describe("the table's Audience cell states the person's other audiences", () => {
  // A cell stating one name alone would state one campaign's answer as the person's.
  it("counts them off the served cards", () => {
    expect(page).toContain("for (const card of lead.campaigns ?? [])");
    expect(page).toContain("extra: Math.max(0, ids.size - 1)");
    expect(page).toContain("audiences across this person's campaigns");
  });
});

describe("the model stays alias-free so it carries real unit tests", () => {
  it("imports nothing", () => {
    expect(tree).not.toContain('from "@/');
    expect(tree).not.toMatch(/^import /m);
  });
});
