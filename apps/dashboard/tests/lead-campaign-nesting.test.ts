import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The lead panel is about a PERSON, and everything a campaign decided about them sits
 * under that campaign.
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

describe("the lead panel nests a person's campaigns", () => {
  it("renders the tree, built from the open person's own rows", () => {
    expect(page).toContain("<LeadCampaignSections tree={leadCampaignTree}");
    expect(page).toContain("buildLeadCampaignTree(selectedPersonRows, campaignInfoOf)");
    expect(page).toContain("rowsByPerson.get(leadPersonKey(selectedLead))");
  });

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
});

describe("the timeline states its scope only where it is ambiguous", () => {
  // Both halves are WIRE facts, not layout: lead-service flattens delivery evidence
  // brand-wide on a brand-scoped read, and the by-lead email read answers with one
  // generation for a person who has one per campaign. Nesting the rows under each card
  // today would print byte-identical rows under every one of them.
  it("keeps the timeline at person level and says so above one campaign", () => {
    expect(page).toContain("leadCampaignTree.campaignCount > 1");
    expect(page).toContain("Across every campaign above. We cannot split these per campaign yet.");
    // A person in ONE campaign has a timeline that is that campaign's by construction,
    // so the line would be noise — the prop is null there.
    expect(page).toContain("scopeNote={");
  });

  // Deliberately NOT nested yet. A guard against the honest-looking wrong fix: moving
  // the rows inside the cards before the producers answer per campaign.
  it("does not render a timeline inside a campaign card", () => {
    expect(sections).not.toContain("LeadTimeline");
    expect(sections).not.toContain("firstSentAt");
  });
});

describe("the table lists one row per person", () => {
  // lead-service serves `(person x campaign)` rows, so a person in 11 campaigns was
  // 11 rows every one of which opened a panel about the same human being — and the
  // header counted people-times-campaigns while the stat card beside it counted people.
  it("dedupes the rows the table, tabs, board and CSV all read", () => {
    expect(page).toContain("dedupeLeadRowsByPerson(rawLeads)");
    expect(page).toContain("const { rows: leads, byPerson: rowsByPerson }");
  });

  // The deep-link seed keeps reading the RAW rows: a funnel-leg board card links to
  // the row it holds, which may not be the row representing that person in the table.
  it("seeds the ?leadRowId= deep link off the raw rows", () => {
    expect(page).toContain("rawLeads.find((l) => l.id === initialLeadRowId)");
  });

  // A cell stating one name alone would state one campaign's answer as the person's.
  it("states the person's other audiences on the Audience cell", () => {
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
