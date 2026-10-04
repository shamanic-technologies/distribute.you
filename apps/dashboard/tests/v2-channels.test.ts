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
  it("the offer's Channels and a channel's page are the Channels section", () => {
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/channels")).toBe("channels");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f/channels/sales-cold-email-outreach")).toBe("channels");
    expect(v2SectionOf("/v2/orgs/o/brands/b/channels")).toBe("channels");
    expect(v2SectionOf("/v2/orgs/o/brands/b/offers/f")).toBe("offers");
  });
});

describe("sidebar", () => {
  const shell = read("src/components/v2/v2-shell.tsx");
  it("has no Mailbox section: Inbox and Sent live on the cold email page (owner 2026-10-04)", () => {
    expect(shell).not.toContain('title="Mailbox"');
    expect(shell).not.toContain('label="Inbox"');
    expect(shell).not.toContain('label="Sent"');
  });
  it("Setup lists Channels right under Targeting", () => {
    const setup = shell.slice(shell.indexOf('<Group title="Setup">'), shell.indexOf('label="Integrations"'));
    expect(setup.indexOf('label="Targeting"')).toBeGreaterThan(-1);
    expect(setup.indexOf('label="Channels"')).toBeGreaterThan(setup.indexOf('label="Targeting"'));
    expect(setup).toContain('v2OfferHref(orgId, brandId, offerId, "channels")');
  });
});

describe("channel pages", () => {
  const list = read("src/components/v2/offer-channels-page.tsx");
  const page = read("src/components/v2/offer-channel-page.tsx");
  it("the Channels table opens cold email's own page", () => {
    expect(list).toContain("channelRows(sections)");
    expect(list).toContain("isColdEmailChannel(row.slug) ? v2OfferChannelHref(orgId, brandId, offerId, row.slug) : null");
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
  it("Delivered and the Interested total are lead-service's people counts", () => {
    expect(page).toContain('<StepBar label="Delivered" count={people?.delivered ?? null} of={counts.contacted} />');
    expect(page).toContain("total={people?.interested ?? null}");
  });
  it("people steps are vertical bars in a 2/3 card, the tabs' summaries at 1/3 (owner 2026-10-04)", () => {
    expect(page).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    for (const tab of ["inbox", "sent", "targeting", "settings"]) expect(page).toContain(`href={tabHref("${tab}")}`);
    expect(page).toContain("See more");
    expect(page).toContain("height: barHeight(");
    expect(page).not.toContain("StepRow");
  });
});
