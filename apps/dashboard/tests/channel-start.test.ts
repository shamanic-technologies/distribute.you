import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { channelStartErrorMessage, channelStatusSummary, startableWorkflowDynastySlug } from "../src/lib/channel-start";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

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
