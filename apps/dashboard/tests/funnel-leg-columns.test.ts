import { describe, it, expect } from "vitest";
import {
  buildLegColumns,
  channelsForLeg,
  legChannelState,
} from "../src/lib/funnel-leg-columns";
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

  it("offers the booking channels on the leg out of a positive reply, and no entry channel", () => {
    const booking = LEGS[1];
    const slugs = channelsForLeg(booking, ALL).map((c) => c.featureSlug);
    expect(slugs).toEqual(["ai-meeting-booking"]);
    expect(slugs).not.toContain("sales-cold-email-outreach");
  });

  // A card nobody can turn on is a dead button, which is the whole failure this gate
  // exists to prevent. `agency-meeting-attendance` is published and has no workflow.
  it("drops a platform channel campaign-service provisions nothing for", () => {
    const attendance = LEGS[2];
    const slugs = channelsForLeg(attendance, ALL).map((c) => c.featureSlug);
    expect(slugs).not.toContain("agency-meeting-attendance");
  });

  // Owner-decided 2026-09-25: the board offers the channels WE run. A card for an arrow
  // the brand works by hand was read by nobody.
  it("drops a customer-operated channel", () => {
    for (const leg of LEGS) {
      expect(channelsForLeg(leg, ALL).some((c) => c.operatedBy === "customer"), leg.label).toBe(
        false,
      );
    }
  });

  it("files a channel under no leg of a funnel that does not contain its arrow", () => {
    for (const leg of LEGS) {
      expect(channelsForLeg(leg, ALL).map((c) => c.featureSlug)).not.toContain(
        "your-team-signup-conversion",
      );
    }
  });

  it("matches on BOTH steps, so a shared destination is not a shared leg", () => {
    // AI booking reaches `meeting_booked`, but out of a reply, never out of a visit.
    const fromVisit = { fromIndex: 0, toIndex: 1, fromKey: "website_visit", toKey: "meeting_booked", label: "x" };
    const slugs = channelsForLeg(fromVisit, ALL).map((c) => c.featureSlug);
    expect(slugs).not.toContain("ai-meeting-booking");
  });
});

describe("buildLegColumns", () => {
  it("gives a column to each arrow a channel of ours performs, in the funnel's own order", () => {
    const cols = buildLegColumns({ legs: LEGS, channels: ALL, savedCentsBySlug: {}, runningBySlug: {}, hasCampaignBySlug: {} });
    expect(cols.map((c) => c.leg.toKey)).toEqual(["conversation", "meeting_booked"]);
  });

  // Owner-decided 2026-09-25: an arrow no channel of ours can work gets no column.
  it("drops a column left with no card", () => {
    const cols = buildLegColumns({ legs: LEGS, channels: [COLD], savedCentsBySlug: {}, runningBySlug: {}, hasCampaignBySlug: {} });
    expect(cols).toHaveLength(1);
    expect(cols[0].cards).toHaveLength(1);
  });

  // The offer-scoped narrowing already lives in `funnelChannelBudgets`, which Offer
  // Settings reads. This module takes its ANSWER rather than re-deriving it: a second
  // copy is how two surfaces come to disagree about one channel's money.
  it("reads each card's ceiling from the resolved map, and zero for an absent slug", () => {
    const cols = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "ai-meeting-booking": 500, "sales-cold-email-outreach": 2400 },
      runningBySlug: {}, hasCampaignBySlug: {},
    });
    const ai = cols[1].cards.find((c) => c.channel.featureSlug === "ai-meeting-booking")!;
    expect(ai.savedCents).toBe(500);
    expect(ai.funded).toBe(true);
    const crm = cols[0].cards.find((c) => c.channel.featureSlug === "sales-crm-email-outreach")!;
    expect(crm.savedCents).toBe(0);
    expect(crm.funded).toBe(false);
  });

  it("treats a zero ceiling as not funded, which is how a channel is turned off", () => {
    const cols = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "ai-meeting-booking": 0 },
      runningBySlug: {}, hasCampaignBySlug: {},
    });
    const ai = cols[1].cards.find((c) => c.channel.featureSlug === "ai-meeting-booking")!;
    expect(ai.funded).toBe(false);
  });
});

// Money and STATUS are two independent facts about one channel. A card derived from the
// ceiling alone said `Running` about a campaign stopped for weeks while the modal it
// opens showed that channel's toggle OFF — two facts that cannot both be true of one
// channel, on one screen.
describe("legChannelState", () => {
  it("reads Paused for a funded channel whose campaign is stopped", () => {
    // The reported case: a $10/day ceiling billing still holds, campaign stopped.
    expect(legChannelState({ savedCents: 1000, running: false, hasCampaign: true })).toBe("paused");
  });

  it("reads Running when the resolver says a campaign is running", () => {
    expect(legChannelState({ savedCents: 1000, running: true, hasCampaign: true })).toBe("running");
  });

  // THE regression. This block used to assert the opposite, on the premise that
  // "funded IS running when there is no campaign to ask, because campaign-service
  // provisions one on its next tick". campaign-service deleted that on 2026-09-06
  // ("money starts nothing"), so a funded channel with no campaign runs NOTHING and
  // never will until a person starts it. Production carried one reading `Running` here
  // at the same moment Offer Settings read `Paused` for the same offer, the same funnel
  // and the same channel, with neither true.
  it("reads NOT STARTED for a funded channel that has no campaign at all", () => {
    expect(legChannelState({ savedCents: 50_000, running: false, hasCampaign: false })).toBe(
      "not_started",
    );
  });

  it("never lets the ceiling decide that something runs", () => {
    expect(legChannelState({ savedCents: 999_999, running: false, hasCampaign: true })).toBe(
      "paused",
    );
    expect(legChannelState({ savedCents: 0, running: true, hasCampaign: true })).toBe("running");
  });

  // A channel nobody has bought is not "paused" — telling a customer it is invites them
  // to look for a switch that was never flipped. It is not "not started" either: there
  // is nothing to start until it is funded.
  it("keeps Not funded as its own state", () => {
    expect(legChannelState({ savedCents: 0, running: false, hasCampaign: false })).toBe(
      "not_funded",
    );
  });

  // No silent guess: a card must not state a verdict it does not have yet.
  it("reads unknown while either read is unsettled", () => {
    expect(legChannelState({ savedCents: 1000, running: undefined, hasCampaign: true })).toBe(
      "unknown",
    );
    expect(legChannelState({ savedCents: 1000, running: false, hasCampaign: undefined })).toBe(
      "unknown",
    );
    expect(legChannelState({ savedCents: 0, running: undefined, hasCampaign: undefined })).toBe(
      "unknown",
    );
  });
});

describe("buildLegColumns state", () => {
  it("gives each card the verdict its slug carries", () => {
    const cols = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "sales-cold-email-outreach": 1000, "sales-crm-email-outreach": 500 },
      runningBySlug: { "sales-cold-email-outreach": false, "sales-crm-email-outreach": true },
      hasCampaignBySlug: { "sales-cold-email-outreach": true, "sales-crm-email-outreach": true },
    });
    const byslug = Object.fromEntries(cols[0].cards.map((c) => [c.channel.featureSlug, c.state]));
    expect(byslug["sales-cold-email-outreach"]).toBe("paused");
    expect(byslug["sales-crm-email-outreach"]).toBe("running");
  });

  // A slug absent from a SETTLED map is a channel no row covers: not running, and with
  // no campaign either, so a funded one reads NOT STARTED. Absent from an UNSETTLED map
  // is a question we cannot answer yet.
  it("separates an absent slug from an unsettled read", () => {
    const settled = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "ai-meeting-booking": 1000 },
      runningBySlug: {}, hasCampaignBySlug: {},
    });
    expect(settled[1].cards.find((c) => c.channel.featureSlug === "ai-meeting-booking")!.state).toBe(
      "not_started",
    );

    const unsettled = buildLegColumns({
      legs: LEGS,
      channels: ALL,
      savedCentsBySlug: { "ai-meeting-booking": 1000 },
      runningBySlug: undefined, hasCampaignBySlug: undefined,
    });
    expect(
      unsettled[1].cards.find((c) => c.channel.featureSlug === "ai-meeting-booking")!.state,
    ).toBe("unknown");
  });
});
