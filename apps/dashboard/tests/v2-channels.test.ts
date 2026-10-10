import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { channelRows } from "../src/lib/offer-channel-settings";
import { v2OfferChannelHref, v2SectionOf } from "../src/lib/v2/routes";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("Channels table rows", () => {
  it("one row per channel, its validated legs in section order; a team-only leg makes no row", () => {
    const rows = channelRows([
      { legKey: "start_to_conversation", fromKey: null, toKey: "conversation", channels: ["sales-cold-email-outreach"] },
      { legKey: "start_to_website_visit", fromKey: null, toKey: "website_visit", channels: ["sales-cold-email-outreach"] },
      { legKey: "conversation_to_meeting_booked", fromKey: "conversation", toKey: "meeting_booked", channels: ["ai-meeting-booking"] },
      { legKey: "meeting_booked_to_paid_client", fromKey: "meeting_booked", toKey: "paid_client", channels: [] },
    ]);
    expect(rows.map((r) => r.slug)).toEqual(["sales-cold-email-outreach", "ai-meeting-booking"]);
    expect(rows[0].legs.map((l) => l.legKey)).toEqual(["start_to_conversation", "start_to_website_visit"]);
  });
  it("no validated leg, no row", () => {
    expect(channelRows([])).toEqual([]);
  });
});

describe("channel routes", () => {
  it("a channel's page sits under the offer's Channels, Overview carries no tab", () => {
    expect(v2OfferChannelHref("o", "b", "f", "sales-cold-email-outreach")).toBe("/v2/orgs/o/brands/b/offers/f/channels/sales-cold-email-outreach");
    expect(v2OfferChannelHref("o", "b", "f", "sales-cold-email-outreach", "overview")).toBe("/v2/orgs/o/brands/b/offers/f/channels/sales-cold-email-outreach");
    expect(v2OfferChannelHref("o", "b", "f", "sales-cold-email-outreach", "inbox")).toBe("/v2/orgs/o/brands/b/offers/f/channels/sales-cold-email-outreach?tab=inbox");
  });
  it("the offer's old Campaigns URL and the channel pages belong to Outbound (owner 2026-10-08)", () => {
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/campaigns")).toBe("sales-path");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/channels")).toBe("sales-path");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/channels/sales-cold-email-outreach")).toBe("sales-path");
    expect(v2SectionOf("/v2/orgs/o/brands/b/channels")).toBe("channels");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f")).toBe("offers");
  });
  it("the offer's Sales path is the Sales path section", () => {
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/sales-path")).toBe("sales-path");
    expect(v2SectionOf("/v2/orgs/o/brands/b/sales-path")).toBe("sales-path");
  });
});

describe("sidebar", () => {
  const shell = read("src/components/v2/v2-shell.tsx");
  it("has no Mailbox section: Inbox and Sent live on the cold email page (owner 2026-10-04)", () => {
    expect(shell).not.toContain('title="Mailbox"');
    expect(shell).not.toContain('label="Inbox"');
    expect(shell).not.toContain('label="Sent"');
  });
  // The owner's sketch (2026-10-10), token for token: Today, Records (Companies, People,
  // Deals), Unibox, Campaigns (Overview + ON campaigns), Outcomes (Overview + one per step),
  // Setup (Offer, Brand). No category header for campaigns; staff pages under the GA nav.
  const at = (needle: string) => shell.indexOf(needle);
  it("reads the sketch in order", () => {
    const order = [
      'label="Today"',
      ">Records</span>",
      'label="Companies"',
      'label="People"',
      'label="Deals"',
      'label="Unibox"',
      '<Group title="Campaigns">',
      '<Group title="Outcomes">',
      '<Group title="Setup">',
      'label="Offer"',
      'label="Brand"',
      '<Group title="Staff">',
    ].map(at);
    expect(order.every((x, i) => x > -1 && (i === 0 || x > order[i - 1]))).toBe(true);
  });
  it("no campaign categories, no Top companies, nothing else in Setup", () => {
    for (const t of ["Outbound", "Posting", "Sourcing", "Top companies"]) expect(shell).not.toContain(`<Group title="${t}">`);
    expect(shell).not.toContain(".filter(({ campaign })");
    const setup = shell.slice(at('<Group title="Setup">'), at('<Group title="Staff">'));
    expect(setup.match(/<NavItem/g)?.length).toBe(2);
    for (const l of ["Targeting", "Integrations", "Brand settings"]) expect(setup).not.toContain(`label="${l}"`);
  });
  it("Campaigns: its Overview, then every ON campaign with its face and a live dot, no indent", () => {
    const block = shell.slice(at('<Group title="Campaigns">'), at('<Group title="Outcomes">'));
    expect(block.indexOf('label="Overview"')).toBeLessThan(block.indexOf("ongoing.map("));
    expect(block).toContain('v2Href(orgId, brandId, "campaigns")');
    expect(block).toContain("<PathAvatar name={name} size={16} />");
    expect(block).toContain("bg-[var(--run)]");
    expect(block).not.toContain("indent");
  });
  it("Outcomes: its Overview, then one entry per step the ON campaigns produce", () => {
    const block = shell.slice(at('<Group title="Outcomes">'), at('<Group title="Setup">'));
    expect(block).toContain("v2OutcomeHref(orgId, brandId)");
    expect(block).toContain("outcomes.map(({ outcome })");
    expect(block).not.toContain("indent");
  });
  it("Workflows, Sales path, Channels, Sourcing and Posts sit in the staff block only", () => {
    const gaNav = shell.slice(0, at('<Group title="Staff">'));
    const staff = shell.slice(at('{staffMode && (\n          <Group title="Staff">'), at("</nav>"));
    expect(at('{staffMode && (\n          <Group title="Staff">')).toBeGreaterThan(-1);
    for (const l of ["Workflows", "Sales path", "Channels", "Sourcing", "Posts"]) {
      expect(gaNav).not.toContain(`label="${l}"`);
      expect(staff).toContain(`label="${l}"`);
    }
  });
});

describe("channel pages", () => {
  const table = read("src/components/v2/offer-campaigns.tsx");
  const outbound = read("src/components/v2/offer-sales-path-page.tsx");
  const page = read("src/components/v2/offer-channel-page.tsx");
  it("the Campaigns page folded into Outbound: every campaign the offer ran, each opening its page (owner 2026-10-08)", () => {
    // The old URL redirects; the page component is gone.
    expect(existsSync(join(__dirname, "..", "src/components/v2/offer-campaigns-page.tsx"))).toBe(false);
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/offers/[offerId]/campaigns/page.tsx")).toContain("/sales-path`);");
    // Outbound lists ticked-path campaigns AND every one that ran, with their results.
    expect(outbound).toContain("roiUnavailableLabel, (k) => ran.has(k))");
    expect(outbound).toMatch(/<OfferCampaigns[\s\S]*?\bresults\b[\s\S]*?\/>/);
    const results = table.slice(table.indexOf("{results ? (\n                  <tr"), table.indexOf(") : (\n                  <tr"));
    // Column order (owner 2026-10-05): name, type, ROI, # outcomes, $ value, $ / outcome, $ invested, status, budget.
    const order = ["Campaign", "Type", "ROI", "# Outcomes", "$ Value", "$ / Outcome", "$ Invested", "Status", "Budget"].map((h) => results.indexOf(`>${h}</th>`));
    expect(order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1]))).toBe(true);
    // ROI is the campaign's measured return (its campaign page's tile), never the path forecast.
    const cells = table.slice(table.indexOf("function CampaignResultCells("), table.indexOf("function UnlistedRow("));
    expect(cells).toContain("shownReturn(g?.economicsMaturity, basis)");
    expect(cells).not.toContain("campaign.roi");
    expect(results).not.toContain("EXPECTED_ROI_TIP");
    // A row opens its campaign page; the status and budget cells never do.
    expect(table).toContain("go: () => router.push(mission.href)");
    expect(table.match(/onClick=\{stop\}/g)?.length).toBe(2);
  });
  it("cold email's page carries Overview, Inbox, Sent, Targeting and Settings", () => {
    for (const label of ["Overview", "Inbox", "Sent", "Targeting", "Settings"]) expect(page).toContain(`label: "${label}"`);
    expect(page).toContain('<PeoplePage bucket="positive_reply" />');
    expect(page).toContain('<PeoplePage bucket="contacted" />');
    expect(page).toContain("<V2AudiencesTable offerId={offerId} />");
    expect(page).toContain("<ColdEmailChannelSettings brandId={brandId} offerId={offerId} channelSlug={channelSlug} />");
  });
  it("the overview reads served figures and never sums Interested", () => {
    expect(page).toContain("useBrandRevenueWindow(brandId, SINCE_INCEPTION)");
    expect(page).not.toContain("TODAY_WINDOWS");
    expect(page).toContain("useBucketCounts(brandId)");
    expect(page).not.toMatch(/website_visit\s*\+/);
    expect(page).not.toMatch(/positive_reply\s*\+/);
    expect(page).not.toMatch(/visits\s*\+\s*replies/);
  });
  it("one steps card per leg, read on the leg's campaign, stopping at its outcome (owner 2026-10-04)", () => {
    expect(page).toContain('legKey: OUTBOUND_LEG_TO_WEBSITE_VISIT, title: "Website visits", outcome: "Website visit"');
    expect(page).toContain('legKey: OUTBOUND_LEG_TO_CONVERSATION, title: "Positive replies", outcome: "Positive reply"');
    expect(page).toContain("getLeadBucketCounts({ campaignId }, {})");
    // A leg no campaign aims at gets no card, never an empty note.
    expect(page).toContain("return campaignId ? [{ ...leg, campaignId }] : [];");
    expect(page).not.toContain("No campaign aims at this yet");
    expect(page).toContain('<StepBar label="Queued" count={queued} of={scale} />');
    expect(page).toContain('<StepBar label="Delivered" count={delivered} of={scale} />');
    // Sent sits between Queued and Delivered (owner 2026-10-05).
    expect(page).toContain('<StepBar label="Sent" count={sent} of={scale} />');
    // Emails, not people (owner 2026-10-06): the bars read the campaign window.
    expect(page).toContain("const sent = win.data?.emails?.sent ?? null;");
    expect(page.indexOf('<StepBar label="Sent"')).toBeGreaterThan(page.indexOf('<StepBar label="Queued"'));
    expect(page.indexOf('<StepBar label="Delivered"')).toBeGreaterThan(page.indexOf('<StepBar label="Sent"'));
    for (const gone of ["Meeting booked", "Meeting attended", "Paid client", 'label="Contacted"']) expect(page).not.toContain(gone);
  });
  it("stat cards open with People then Queued before Sent", () => {
    expect(page).toContain("const queued = win.data?.queuedEmails ?? null;");
    expect(page.indexOf('<StatTile label="People">')).toBeGreaterThan(-1);
    expect(page.indexOf('<StatTile label="Queued">')).toBeGreaterThan(page.indexOf('<StatTile label="People">'));
    expect(page.indexOf('<StatTile label="Sent">')).toBeGreaterThan(page.indexOf('<StatTile label="Queued">'));
  });
  it("people steps are vertical bars in a 2/3 card, the tabs' summaries at 1/3 (owner 2026-10-04)", () => {
    expect(page).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    for (const tab of ["inbox", "sent", "targeting", "settings"]) expect(page).toContain(`href={tabHref("${tab}")}`);
    expect(page).toContain("See more");
    expect(page).toContain("height: barHeight(");
    expect(page).not.toContain("StepRow");
  });
});
