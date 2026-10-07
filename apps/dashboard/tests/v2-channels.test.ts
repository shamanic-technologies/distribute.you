import { readFileSync } from "node:fs";
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
  it("the offer's Campaigns, and the older channel pages, are the Campaigns section", () => {
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/campaigns")).toBe("campaigns");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/channels")).toBe("campaigns");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/channels/sales-cold-email-outreach")).toBe("campaigns");
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
  it("Setup lists Campaigns right under Targeting, no Channels entry (owner 2026-10-05)", () => {
    const setup = shell.slice(shell.indexOf('<Group title="Setup">'), shell.indexOf('label="Integrations"'));
    expect(setup.indexOf('label="Targeting"')).toBeGreaterThan(-1);
    expect(setup.indexOf('label="Campaigns"')).toBeGreaterThan(setup.indexOf('label="Targeting"'));
    expect(setup).toContain('v2OfferHref(orgId, brandId, offerId, "campaigns")');
    expect(setup).not.toContain('label="Channels"');
  });
  it("Outbound is a section like Setup: Sales path, then the ON campaigns, no indent (owner 2026-10-07)", () => {
    const outbound = shell.slice(shell.indexOf('<Group title="Outbound">'), shell.indexOf('<Group title="Setup">'));
    expect(shell.indexOf('<Group title="Outbound">')).toBeGreaterThan(-1);
    expect(outbound.indexOf('label="Sales path"')).toBeGreaterThan(-1);
    expect(outbound.indexOf('label="Sales path"')).toBeLessThan(outbound.indexOf("activeMissions"));
    expect(outbound).toContain('v2OfferHref(orgId, brandId, offerId, "sales-path")');
    expect(outbound).toContain("bg-[var(--run)]");
    expect(outbound).not.toContain("indent");
    expect(shell).not.toContain('title="Campaigns"');
  });

  it("Sidebar order (owner 2026-10-07): Outbound, Posting, then a Sourcing section (its page, then ON source campaigns), then Setup", () => {
    const outbound = shell.indexOf('<Group title="Outbound">');
    const posting = shell.indexOf('<Group title="Posting">');
    const sourcing = shell.indexOf('<Group title="Sourcing">');
    const setup = shell.indexOf('<Group title="Setup">');
    expect(outbound).toBeGreaterThan(-1);
    expect(posting).toBeGreaterThan(outbound);
    expect(sourcing).toBeGreaterThan(posting);
    expect(setup).toBeGreaterThan(sourcing);
    const block = shell.slice(sourcing, setup);
    expect(block).toContain('v2OfferHref(orgId, brandId, offerId, "sourcing")');
    expect(block).toContain('.filter(({ campaign }) => campaign?.kind === "source")');
  });
});

describe("channel pages", () => {
  const list = read("src/components/v2/offer-campaigns-page.tsx");
  const page = read("src/components/v2/offer-channel-page.tsx");
  it("Campaigns lists every campaign the offer ran, read only, each opening its page (owner 2026-10-05)", () => {
    expect(list).toContain(".filter((m) => m.offerId === offerId)");
    expect(list).toContain("router.push(m.href)");
    for (const h of ["Status", "Budget", "$ Invested", "$ Value", "# Outcomes", "$ / Outcome"]) expect(list).toContain(`>${h}</th>`);
    // Column order (owner 2026-10-05): name, ROI, # outcomes, $ value, $ / outcome, $ invested, status, budget.
    const order = ["Campaign", "ROI", "# Outcomes", "$ Value", "$ / Outcome", "$ Invested", "Status", "Budget"].map((h) => list.indexOf(`>${h}</th>`));
    expect(order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1]))).toBe(true);
    // ROI is the measured return: Learning unless mature or above 1x (shownReturn), never the expected figure.
    expect(list).toContain("shownReturn(g?.economicsMaturity, basis)");
    expect(list).not.toContain("EXPECTED_ROI_TIP");
    // The name reads like Today: the leg on its own line under it.
    expect(list).toContain("<CampaignLeg campaign={leg} compact />");
    // Status and budget are changed on the Sales path page only: no write here.
    for (const w of ["setCampaignStatus", "saveOfferCampaignBudget", "useMutation", "<button"]) expect(list).not.toContain(w);
    expect(list).toContain("Sales path page");
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
    expect(page).toContain('legKey: "start_to_website_visit", title: "Website visits", outcome: "Website visit"');
    expect(page).toContain('legKey: "start_to_conversation", title: "Positive replies", outcome: "Positive reply"');
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
