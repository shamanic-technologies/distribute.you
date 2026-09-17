import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANNEL_RUN_STATE_LABEL,
  channelRunState,
  channelStartBlocker,
  channelStartErrorMessage,
  channelStatusSummary,
  startableWorkflowDynastySlug,
} from "../src/lib/channel-start";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("channelRunState", () => {
  it("is running when campaign-service reports a running campaign", () => {
    expect(channelRunState({ settled: true, campaignId: "c1", running: true })).toBe("running");
  });

  it("is paused when the campaign exists and is not running", () => {
    expect(channelRunState({ settled: true, campaignId: "c1", running: false })).toBe("paused");
  });

  // The whole reason this module exists. Funding a channel has not created a campaign
  // since campaign-service deleted provisioning on 2026-09-06, so money says NOTHING
  // about whether anything runs.
  it("is NOT_STARTED when the channel is funded but has no campaign", () => {
    expect(channelRunState({ settled: true, campaignId: null, running: false })).toBe("not_started");
  });

  it("is NOT_STARTED when the channel has neither campaign nor money", () => {
    expect(channelRunState({ settled: true, campaignId: null, running: false })).toBe("not_started");
  });

  it("is unknown while the reads are in flight, never a guess", () => {
    expect(channelRunState({ settled: false, campaignId: null, running: false })).toBe("unknown");
    expect(channelRunState({ settled: false, campaignId: "c1", running: true })).toBe("unknown");
  });

  it("labels every state, and says nothing for unknown", () => {
    expect(CHANNEL_RUN_STATE_LABEL.running).toBe("Running");
    expect(CHANNEL_RUN_STATE_LABEL.paused).toBe("Paused");
    expect(CHANNEL_RUN_STATE_LABEL.not_started).toBe("Not started");
    expect(CHANNEL_RUN_STATE_LABEL.unknown).toBe("");
  });
});

describe("channelStartBlocker", () => {
  it("refuses a start with no daily budget, and says to fund it", () => {
    const blocker = channelStartBlocker({ state: "not_started", typedCents: 0 });
    expect(blocker).toMatch(/daily budget/i);
  });

  it("refuses a restart with no daily budget too", () => {
    expect(channelStartBlocker({ state: "paused", typedCents: 0 })).not.toBeNull();
  });

  it("allows a start once the channel is funded", () => {
    expect(channelStartBlocker({ state: "not_started", typedCents: 500 })).toBeNull();
    expect(channelStartBlocker({ state: "paused", typedCents: 100 })).toBeNull();
  });

  // Stopping is never refused for want of money.
  it("never blocks a running channel, whatever its budget reads", () => {
    expect(channelStartBlocker({ state: "running", typedCents: 0 })).toBeNull();
  });

  it("never blocks while the state is unknown", () => {
    expect(channelStartBlocker({ state: "unknown", typedCents: 0 })).toBeNull();
  });
});

describe("channelStatusSummary", () => {
  it("says nothing when no switch moved", () => {
    expect(channelStatusSummary([])).toBeNull();
  });

  it("warns that starting spends NOW rather than at the next tick", () => {
    const summary = channelStatusSummary([{ channelName: "Cold email", kind: "start" }]);
    expect(summary).toContain("Cold email");
    expect(summary).toMatch(/immediately/i);
    expect(summary).toMatch(/not at the next daily tick/i);
  });

  it("says the same for a restart of an existing campaign", () => {
    const summary = channelStatusSummary([{ channelName: "Cold email", kind: "restart" }]);
    expect(summary).toMatch(/immediately/i);
  });

  // The alternative a customer reaches for is emptying the amount, and that one is
  // NOT free to undo under billing's per-funnel floor.
  it("says a pause KEEPS the daily budget", () => {
    const summary = channelStatusSummary([{ channelName: "Cold email", kind: "pause" }]);
    expect(summary).toMatch(/budget is kept/i);
    expect(summary).toMatch(/one click/i);
  });

  it("states both halves when some start and some pause", () => {
    const summary = channelStatusSummary([
      { channelName: "Cold email", kind: "start" },
      { channelName: "AI meeting booking", kind: "pause" },
    ]);
    expect(summary).toContain("Starting Cold email");
    expect(summary).toContain("Pausing AI meeting booking");
  });

  it("joins several names without a trailing and on a single one", () => {
    expect(channelStatusSummary([{ channelName: "A", kind: "start" }])).toContain("Starting A now");
    const two = channelStatusSummary([
      { channelName: "A", kind: "start" },
      { channelName: "B", kind: "start" },
    ]);
    expect(two).toContain("A and B");
    const three = channelStatusSummary([
      { channelName: "A", kind: "start" },
      { channelName: "B", kind: "start" },
      { channelName: "C", kind: "start" },
    ]);
    expect(three).toContain("A, B and C");
  });

  it("agrees its verb with the number of channels", () => {
    expect(channelStatusSummary([{ channelName: "A", kind: "start" }])).toContain("it begins");
    expect(
      channelStatusSummary([
        { channelName: "A", kind: "start" },
        { channelName: "B", kind: "start" },
      ]),
    ).toContain("they begin");
  });
});

describe("channelStartErrorMessage", () => {
  it("names the channel as unrunnable on a 400 start, never the amount", () => {
    const msg = channelStartErrorMessage(400, "start");
    expect(msg).toMatch(/not be ready to run/i);
    expect(msg).not.toMatch(/amount/i);
  });

  it("sends a 402 to the credit balance", () => {
    expect(channelStartErrorMessage(402, "start")).toMatch(/credit balance/i);
  });

  it("has its own sentence for a refused pause", () => {
    expect(channelStartErrorMessage(404, "pause")).toMatch(/no longer exists/i);
    expect(channelStartErrorMessage(null, "pause")).toMatch(/could not pause/i);
  });

  it("falls back to one generic line rather than echoing a body", () => {
    expect(channelStartErrorMessage(500, "start")).toMatch(/could not start/i);
  });
});

describe("startableWorkflowDynastySlug", () => {
  // Which workflow serves a campaign is the producer's answer. A dashboard that
  // picks one when features-service names none is a second opinion over it.
  it("refuses rather than defaulting when the producer names no workflow", () => {
    expect(startableWorkflowDynastySlug(null)).toBeNull();
    expect(startableWorkflowDynastySlug(undefined)).toBeNull();
    expect(startableWorkflowDynastySlug("   ")).toBeNull();
  });

  it("passes the producer's own pick through", () => {
    expect(startableWorkflowDynastySlug("sales-email-cold-outreach-lithium")).toBe(
      "sales-email-cold-outreach-lithium",
    );
  });
});

describe("the module stays unit-testable and free of em-dashes", () => {
  it("carries no @ alias import, so vitest can load it", () => {
    expect(read("lib/channel-start.ts")).not.toContain('from "@/');
  });

  // Every string in here is copy a customer reads.
  it("ships no em-dash anywhere, comments included", () => {
    expect(read("lib/channel-start.ts")).not.toContain("—");
  });
});
