import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_HOLD_EVENTS,
  CREDIT_RECHECK_MS,
  HOLD_RECHECK_MS,
  campaignHoldCopy,
  readCampaignHold,
  type HoldEventInput,
} from "../src/lib/campaign-hold";

const NOW = new Date("2026-09-17T06:12:14.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

// Verbatim shapes read off production run_events on 2026-09-17 (runs-service).
const ceilingEvent = (createdAt = ago(4 * 60_000)): HoldEventInput => ({
  event: "campaign-hold",
  detail:
    "Campaign not run — it has already spent its whole daily ceiling: 428 of 400 cents committed today on funnel sales_meetings_from_conversation.",
  data: {
    reason: "daily_ceiling_reached",
    funnelKey: "sales_meetings_from_conversation",
    nextRunAt: "2026-09-17T06:13:27.104Z",
    campaignId: "38ba8069-3d50-4ae7-b37a-54409071e260",
    spentCents: 428.3249999985,
    ceilingCents: 400,
  },
  createdAt,
});

const unfundedEvent = (createdAt = ago(9 * 60_000)): HoldEventInput => ({
  event: "campaign-hold",
  detail: "Campaign not run — no funded daily ceiling.",
  data: {
    reason: "unfunded",
    nextRunAt: "2026-09-17T06:12:43.795Z",
    campaignId: "8f40f22d-4e92-4641-b7b9-03b4ad57beed",
  },
  createdAt,
});

const creditEvent = (createdAt = ago(20 * 60_000)): HoldEventInput => ({
  event: "gate-check-result",
  detail:
    "Gate check BLOCKED for campaign 31df7683-09f1-44ea-94c3-c87ea3c01ff5 — reason: Insufficient credits",
  data: {
    reason: "Insufficient credits",
    allowed: false,
    campaignId: "31df7683-09f1-44ea-94c3-c87ea3c01ff5",
    creditCheck: "unaffordable",
  },
  createdAt,
});

const passedGate = (createdAt = ago(60_000)): HoldEventInput => ({
  event: "gate-check-result",
  detail: "Gate check PASSED for campaign f7b1b610-4fa1-4b54-8fec-f7be124dc32b",
  data: { allowed: true, campaignId: "f7b1b610-4fa1-4b54-8fec-f7be124dc32b" },
  createdAt,
});

const runInProgress = (createdAt = ago(60_000)): HoldEventInput => ({
  event: "gate-check-result",
  detail: "Gate check BLOCKED — reason: A run is already in progress",
  data: { reason: "A run is already in progress", allowed: false, campaignId: "x" },
  createdAt,
});

describe("readCampaignHold", () => {
  it("reads the ceiling hold off the producer's own reason", () => {
    const hold = readCampaignHold([ceilingEvent()], NOW);
    expect(hold?.reason).toBe("daily_ceiling_reached");
    expect(hold?.ceilingCents).toBe(400);
    expect(hold?.spentCents).toBeCloseTo(428.325);
  });

  it("promises no restart for a hold only money can clear", () => {
    // The producer's nextRunAt is the moment we look again and hold again. Naming it as
    // a restart would be a sentence that is false until somebody pays.
    expect(readCampaignHold([unfundedEvent()], NOW)?.resumeAt).toBeNull();
    expect(readCampaignHold([creditEvent()], NOW)?.resumeAt).toBeNull();
  });

  it("keeps the producer's nextRunAt for a hold that clears on our side", () => {
    const hold = readCampaignHold(
      [{ event: "campaign-hold", data: { reason: "planning_failed", nextRunAt: "2026-09-17T06:18:00.000Z" }, createdAt: ago(60_000) }],
      NOW,
    );
    expect(hold?.resumeAt).toBe("2026-09-17T06:18:00.000Z");
  });

  it("resumes a spent ceiling at the next UTC midnight, not at the next re-check", () => {
    // The producer's own nextRunAt is ten minutes out and will hold again. Its own
    // sentence says the ceiling clears when the day rolls over.
    const hold = readCampaignHold([ceilingEvent()], NOW);
    expect(hold?.resumeAt).toBe("2026-09-18T00:00:00.000Z");
  });

  it("reads the credit refusal off creditCheck, never the English reason", () => {
    const hold = readCampaignHold([creditEvent()], NOW);
    expect(hold?.reason).toBe("insufficient_credits");
  });

  it("says nothing about a healthy campaign", () => {
    expect(readCampaignHold([passedGate(), passedGate(ago(120_000))], NOW)).toBeNull();
  });

  it("ignores a blocked gate check that is not the credit refusal", () => {
    // "A run is already in progress" fires on healthy campaigns and is not a hold a
    // customer can read; so are "Campaign is not ongoing" and the rest.
    expect(readCampaignHold([runInProgress()], NOW)).toBeNull();
  });

  it("says nothing when there are no events at all", () => {
    expect(readCampaignHold([], NOW)).toBeNull();
  });

  it("drops a hold that has outlived two of its own re-check cycles", () => {
    const stale = ceilingEvent(ago(HOLD_RECHECK_MS * 2 + 1000));
    expect(readCampaignHold([stale], NOW)).toBeNull();
  });

  it("keeps a hold that has only missed one cycle", () => {
    const recent = ceilingEvent(ago(HOLD_RECHECK_MS + 30_000));
    expect(readCampaignHold([recent], NOW)?.reason).toBe("daily_ceiling_reached");
  });

  it("gives the credit refusal its own slower window, matching its own cadence", () => {
    expect(readCampaignHold([creditEvent(ago(CREDIT_RECHECK_MS + 60_000))], NOW)?.reason).toBe(
      "insufficient_credits",
    );
    expect(readCampaignHold([creditEvent(ago(CREDIT_RECHECK_MS * 2 + 1000))], NOW)).toBeNull();
  });

  it("keeps whichever hold the producer wrote last", () => {
    const events = [creditEvent(ago(20 * 60_000)), ceilingEvent(ago(60_000))];
    expect(readCampaignHold(events, NOW)?.reason).toBe("daily_ceiling_reached");
    const other = [creditEvent(ago(60_000)), ceilingEvent(ago(9 * 60_000))];
    expect(readCampaignHold(other, NOW)?.reason).toBe("insufficient_credits");
  });

  it("ignores an event whose data carries no reason it knows", () => {
    const junk: HoldEventInput = {
      event: "campaign-hold",
      data: { reason: "something_new_upstream" },
      createdAt: ago(60_000),
    };
    expect(readCampaignHold([junk], NOW)).toBeNull();
  });

  it("survives a null or non-object data payload", () => {
    expect(
      readCampaignHold(
        [
          { event: "campaign-hold", data: null, createdAt: ago(60_000) },
          { event: "gate-check-result", data: "nope", createdAt: ago(60_000) },
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("asks the gateway for both hold slugs in one read", () => {
    expect(CAMPAIGN_HOLD_EVENTS).toBe("campaign-hold,gate-check-result");
  });
});

describe("campaignHoldCopy", () => {
  it("names the budget and offers the control that raises it", () => {
    const copy = campaignHoldCopy(readCampaignHold([ceilingEvent()], NOW)!, NOW);
    expect(copy.headline).toBe("Today's budget is spent");
    expect(copy.body).toContain("$4");
    expect(copy.action).toBe("campaign_budget");
  });

  it("tells an unfunded campaign where to get funded", () => {
    const copy = campaignHoldCopy(readCampaignHold([unfundedEvent()], NOW)!, NOW);
    expect(copy.action).toBe("campaign_budget");
    expect(copy.body).toContain("daily budget");
  });

  it("sends an out-of-credit campaign to billing", () => {
    const copy = campaignHoldCopy(readCampaignHold([creditEvent()], NOW)!, NOW);
    expect(copy.action).toBe("billing");
    expect(copy.actionLabel).toBe("Add credits");
    expect(copy.headline).toBe("You are out of credit");
  });

  it("asks nothing of the customer when the fault is ours", () => {
    for (const reason of ["budgets_unreadable", "planning_failed"] as const) {
      const hold = readCampaignHold(
        [
          {
            event: "campaign-hold",
            data: { reason, nextRunAt: "2026-09-17T06:20:00.000Z" },
            createdAt: ago(60_000),
          },
        ],
        NOW,
      )!;
      const copy = campaignHoldCopy(hold, NOW);
      expect(hold.reason).toBe(reason);
      expect(copy.action).toBeNull();
      expect(copy.actionLabel).toBeNull();
      expect(copy.body).toContain("ours to fix");
    }
  });

  it("states a resume time a person can read, never an ISO timestamp", () => {
    const copy = campaignHoldCopy(readCampaignHold([ceilingEvent()], NOW)!, NOW);
    expect(copy.body).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    // `timeUntil` counts CALENDAR days like the rest of the module, so a ceiling
    // ~18 hours out reads "in 1 day" west of Greenwich; the clock time beside it is
    // what removes the ambiguity, which is why both are stated.
    expect(copy.body).toMatch(/It starts again in \d+ (hours|day|days), at \d+:\d\d(am|pm) your time\./);
  });

  it("never leaks a reason slug or a run id to the customer", () => {
    const holds = [ceilingEvent(), unfundedEvent(), creditEvent()];
    for (const e of holds) {
      const copy = campaignHoldCopy(readCampaignHold([e], NOW)!, NOW);
      const text = `${copy.headline} ${copy.body} ${copy.actionLabel ?? ""}`;
      expect(text).not.toMatch(/_[a-z]+_|daily_ceiling|unfunded|creditCheck|campaign-hold/);
      expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
      expect(text).not.toContain("—");
    }
  });
});
