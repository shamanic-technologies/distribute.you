import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_HOLD_EVENTS,
  CREDIT_RECHECK_MS,
  HOLD_RECHECK_MS,
  campaignHoldCopy,
  holdOutlivesLimitChange,
  holdsByReason,
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

  it("promises no restart for a hold only money or a raise can clear", () => {
    // A reached limit can be weekly, monthly or a volume (campaign-service 2026-10-18):
    // "the next UTC midnight" would be a false restart.
    expect(readCampaignHold([ceilingEvent()], NOW)?.resumeAt).toBeNull();
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

  it("reads the credit refusal off creditCheck, never the English reason", () => {
    const hold = readCampaignHold([creditEvent()], NOW);
    expect(hold?.reason).toBe("insufficient_credits");
  });

  it("ends a hold once a newer run passes the gate (2026-10-30, limit raised to $80/month)", () => {
    expect(readCampaignHold([ceilingEvent(ago(10 * 60_000)), passedGate(ago(60_000))], NOW)).toBeNull();
  });

  it("keeps a hold written after the last run that passed (the limit was reached again)", () => {
    expect(readCampaignHold([passedGate(ago(9 * 60_000)), ceilingEvent(ago(2 * 60_000))], NOW)?.reason).toBe(
      "daily_ceiling_reached",
    );
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

describe("holdsByReason", () => {
  it("folds a funnel's pipes into one note per reason, newest hold kept", () => {
    const a = readCampaignHold([ceilingEvent(ago(5 * 60_000))], NOW)!;
    const b = readCampaignHold([ceilingEvent(ago(60_000))], NOW)!;
    const c = readCampaignHold([creditEvent()], NOW)!;
    const groups = holdsByReason([["p1", a], ["p2", b], ["p3", null], ["p4", c]]);
    expect(groups.map((g) => g.hold.reason)).toEqual(["daily_ceiling_reached", "insufficient_credits"]);
    expect(groups[0].campaignIds).toEqual(["p1", "p2"]);
    expect(groups[0].hold).toBe(b);
    expect(groups[1].campaignIds).toEqual(["p4"]);
  });

  it("says nothing when no pipe is held", () => {
    expect(holdsByReason([["p1", null]])).toEqual([]);
  });
});

describe("campaignHoldCopy", () => {
  it("names the limit and offers the control that raises it", () => {
    const copy = campaignHoldCopy(readCampaignHold([ceilingEvent()], NOW)!, NOW);
    expect(copy.headline).toBe("This campaign reached its limit");
    expect(copy.body).toContain("max budget or its max volume");
    expect(copy.action).toBe("campaign_budget");
    expect(copy.actionLabel).toBe("Raise the limit");
  });

  it("tells an unfunded campaign where to get funded, never a retired daily budget", () => {
    const copy = campaignHoldCopy(readCampaignHold([unfundedEvent()], NOW)!, NOW);
    expect(copy.action).toBe("campaign_budget");
    expect(copy.body).toContain("max budget or a max volume");
    for (const e of [ceilingEvent(), unfundedEvent(), creditEvent()]) {
      const c = campaignHoldCopy(readCampaignHold([e], NOW)!, NOW);
      expect(`${c.headline} ${c.body} ${c.actionLabel}`).not.toMatch(/daily budget|today/i);
    }
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
      expect(copy.body).toContain("You have nothing to do.");
      expect(copy.body).toContain("We try again in 7 minutes.");
      expect(copy.body).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("never opens a sentence on a pronoun", () => {
    const all = [ceilingEvent(), unfundedEvent(), creditEvent()].map((e) => campaignHoldCopy(readCampaignHold([e], NOW)!, NOW).body);
    for (const body of all) expect(body).not.toMatch(/(^|\. )(It|They|This is) /);
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

describe("holdOutlivesLimitChange", () => {
  const hold = readCampaignHold([ceilingEvent(ago(4 * 60_000))], NOW)!;

  it("drops a limit hold written before the limits changed", () => {
    expect(holdOutlivesLimitChange(hold, ago(60_000))).toBe(false);
  });

  it("keeps a limit hold written after the limits changed (a raise still not enough)", () => {
    expect(holdOutlivesLimitChange(hold, ago(10 * 60_000))).toBe(true);
  });

  it("keeps a hold no limit change can end, and one with no change time", () => {
    const credit = readCampaignHold([creditEvent(ago(4 * 60_000))], NOW)!;
    expect(holdOutlivesLimitChange(credit, ago(60_000))).toBe(true);
    expect(holdOutlivesLimitChange(hold, null)).toBe(true);
  });
});
