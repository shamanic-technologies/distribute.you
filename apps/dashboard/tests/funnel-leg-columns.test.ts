import { describe, it, expect } from "vitest";
import { buildLegColumns, channelsForLeg } from "../src/lib/funnel-leg-columns";
import { funnelLegs } from "../src/lib/campaign-leg";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";
import type { AcquisitionChannelDef } from "../src/lib/acquisition-channels";

const REPLY_MEETING = SALES_FUNNELS.find((f) => f.key === "reply_meeting")!;

function ch(
  featureSlug: string,
  legs: { from: string | null; to: string }[],
  operatedBy: string | null = "platform",
): AcquisitionChannelDef {
  return { featureSlug, name: featureSlug, summary: "", mark: null, operatedBy, legs };
}

const COLD = ch("sales-cold-email-outreach", [
  { from: null, to: "conversation" },
  { from: null, to: "website_visit" },
]);
const CRM = ch("sales-crm-email-outreach", [{ from: null, to: "conversation" }]);
const FEEDBACK = ch("feedback-request-cold-email-outreach", [{ from: null, to: "conversation" }]);
const AI_BOOKING = ch("ai-meeting-booking", [{ from: "conversation", to: "meeting_booked" }]);
const YOUR_TEAM_BOOKING = ch(
  "your-team-meeting-booking",
  [
    { from: "conversation", to: "meeting_booked" },
    { from: "website_visit", to: "meeting_booked" },
  ],
  "customer",
);
// Published, platform-operated, and campaign-service provisions nothing for it.
const AGENCY_ATTENDANCE = ch("agency-meeting-attendance", [
  { from: "meeting_booked", to: "meeting_attended" },
]);
const YOUR_TEAM_ATTENDANCE = ch(
  "your-team-meeting-attendance",
  [{ from: "meeting_booked", to: "meeting_attended" }],
  "customer",
);
// States a leg this funnel does not contain.
const SIGNUP_CONVERSION = ch(
  "your-team-signup-conversion",
  [{ from: "signup", to: "paid_client" }],
  "customer",
);

const ALL = [
  COLD,
  CRM,
  FEEDBACK,
  AI_BOOKING,
  YOUR_TEAM_BOOKING,
  AGENCY_ATTENDANCE,
  YOUR_TEAM_ATTENDANCE,
  SIGNUP_CONVERSION,
];

const LEGS = funnelLegs(REPLY_MEETING);

describe("channelsForLeg", () => {
  it("offers the entry channels on the leg that puts a lead onto the funnel", () => {
    const entry = LEGS[0];
    expect(entry.fromKey).toBeNull();
    const slugs = channelsForLeg(entry, ALL).map((c) => c.featureSlug);
    expect(slugs).toEqual([
      "sales-cold-email-outreach",
      "sales-crm-email-outreach",
      "feedback-request-cold-email-outreach",
    ]);
  });

  it("offers the booking channels on the leg out of a sales interest, and no entry channel", () => {
    const booking = LEGS[1];
    const slugs = channelsForLeg(booking, ALL).map((c) => c.featureSlug);
    expect(slugs).toEqual(["ai-meeting-booking", "your-team-meeting-booking"]);
    expect(slugs).not.toContain("sales-cold-email-outreach");
  });

  // A card nobody can turn on is a dead button, which is the whole failure this gate
  // exists to prevent. `agency-meeting-attendance` is published and has no workflow.
  it("drops a platform channel campaign-service provisions nothing for", () => {
    const attendance = LEGS[2];
    const slugs = channelsForLeg(attendance, ALL).map((c) => c.featureSlug);
    expect(slugs).toEqual(["your-team-meeting-attendance"]);
    expect(slugs).not.toContain("agency-meeting-attendance");
  });

  // Customer-operated is read off the WIRE, so it never consults the provisionable list.
  it("keeps a customer-operated channel whatever the provisionable list says", () => {
    const attendance = LEGS[2];
    expect(channelsForLeg(attendance, ALL)[0].operatedBy).toBe("customer");
  });

  it("files a channel under no leg of a funnel that does not contain its arrow", () => {
    for (const leg of LEGS) {
      expect(channelsForLeg(leg, ALL).map((c) => c.featureSlug)).not.toContain(
        "your-team-signup-conversion",
      );
    }
  });

  it("matches on BOTH steps, so a shared destination is not a shared leg", () => {
    // Both booking channels reach `meeting_booked`; only one does it from a website visit.
    const fromVisit = { fromIndex: 0, toIndex: 1, fromKey: "website_visit", toKey: "meeting_booked", label: "x" };
    const slugs = channelsForLeg(fromVisit, ALL).map((c) => c.featureSlug);
    expect(slugs).toEqual(["your-team-meeting-booking"]);
    expect(slugs).not.toContain("ai-meeting-booking");
  });
});

describe("buildLegColumns", () => {
  it("gives every arrow a column, in the funnel's own order", () => {
    const cols = buildLegColumns({ legs: LEGS, channels: ALL, savedCentsBySlug: {} });
    expect(cols).toHaveLength(4);
    expect(cols.map((c) => c.leg.toKey)).toEqual([
      "conversation",
      "meeting_booked",
      "meeting_attended",
      "paid_client",
    ]);
  });

  // A column with nothing to offer is the honest answer for a leg we do not sell yet.
  // Omitting it would tell a customer their funnel is shorter than it is.
  it("keeps a column that has no fundable channel at all", () => {
    const cols = buildLegColumns({ legs: LEGS, channels: [COLD], savedCentsBySlug: {} });
    expect(cols).toHaveLength(4);
    expect(cols[0].cards).toHaveLength(1);
    expect(cols[1].cards).toEqual([]);
    expect(cols[3].cards).toEqual([]);
  });

  // The offer-scoped narrowing already lives in `funnelChannelBudgets`, which Offer
  // Settings reads. This module takes its ANSWER rather than re-deriving it: a second
  // copy is how two surfaces come to disagree about one channel's money.
  it("reads each card's ceiling from the resolved map, and zero for an absent slug", () => {
    const cols = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "ai-meeting-booking": 500, "sales-cold-email-outreach": 2400 },
    });
    const ai = cols[1].cards.find((c) => c.channel.featureSlug === "ai-meeting-booking")!;
    expect(ai.savedCents).toBe(500);
    expect(ai.funded).toBe(true);
    const yourTeam = cols[1].cards.find(
      (c) => c.channel.featureSlug === "your-team-meeting-booking",
    )!;
    expect(yourTeam.savedCents).toBe(0);
    expect(yourTeam.funded).toBe(false);
  });

  it("treats a zero ceiling as not funded, which is how a channel is turned off", () => {
    const cols = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "ai-meeting-booking": 0 },
    });
    const ai = cols[1].cards.find((c) => c.channel.featureSlug === "ai-meeting-booking")!;
    expect(ai.funded).toBe(false);
  });
});
