import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROLLUP_LABEL,
  ROLLUP_STYLE,
  buildControlRows,
  controlWriteErrorMessage,
  controlsDiff,
  diffSummary,
  hasChanges,
  isRunningStatus,
  nextTotalCents,
  parseDailyBudgetUsd,
  rollupStatus,
  scopeTotalCents,
  type ControlCampaign,
  type ControlDraft,
} from "../src/lib/campaign-controls";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const OFFER_A = "11111111-1111-4111-8111-111111111111";
const OFFER_B = "22222222-2222-4222-8222-222222222222";
const COLD_EMAIL = "sales-cold-email-outreach";

function campaign(over: Partial<ControlCampaign> & { id: string }): ControlCampaign {
  return {
    status: "ongoing",
    funnelKey: "reply_meeting",
    featureSlug: COLD_EMAIL,
    offerId: OFFER_A,
    ...over,
  };
}

/** billing's answer, at the finest grain it serves. */
function budgets(rows: { funnelKey: string; featureSlug: string; offerId: string | null; cents: number }[]) {
  return {
    funnels: [] as { funnelKey: string; dailyBudgetCents: number }[],
    channels: rows.map((r) => ({
      funnelKey: r.funnelKey,
      featureSlug: r.featureSlug,
      dailyBudgetCents: r.cents,
    })),
    offers: rows.map((r) => ({
      funnelKey: r.funnelKey,
      featureSlug: r.featureSlug,
      offerId: r.offerId,
      dailyBudgetCents: r.cents,
    })),
  };
}

describe("buildControlRows — which campaigns a grain controls", () => {
  it("brand grain lists every acquisition-channel campaign, running or not", () => {
    const rows = buildControlRows(
      [
        campaign({ id: "a" }),
        campaign({ id: "b", status: "stopped" }),
      ],
      undefined,
    );
    expect(rows.map((r) => r.campaignId).sort()).toEqual(["a", "b"]);
    // A stopped campaign has to be in the list, or stopping one from here would
    // be irreversible from the UI.
    expect(rows.find((r) => r.campaignId === "b")!.running).toBe(false);
  });

  it("excludes a campaign whose feature is not an acquisition channel", () => {
    const rows = buildControlRows(
      [campaign({ id: "a" }), campaign({ id: "pr", featureSlug: "pr-expert-quote" })],
      undefined,
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["a"]);
  });

  it("offer grain reads the campaign's OWN offerId, and drops a campaign carrying none", () => {
    const rows = buildControlRows(
      [
        campaign({ id: "mine" }),
        campaign({ id: "sibling", offerId: OFFER_B }),
        campaign({ id: "orphan", offerId: null }),
      ],
      undefined,
      { offerId: OFFER_A },
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["mine"]);
  });

  it("campaign grain yields exactly one row", () => {
    const rows = buildControlRows(
      [campaign({ id: "a" }), campaign({ id: "b" })],
      undefined,
      { campaignId: "b" },
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["b"]);
  });

  it("each row's ceiling is narrowed by its OWN offer, never the surface's", () => {
    const set = budgets([
      { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 2400 },
      { funnelKey: "visit_signup", featureSlug: COLD_EMAIL, offerId: OFFER_B, cents: 900 },
    ]);
    const rows = buildControlRows(
      [
        campaign({ id: "a" }),
        campaign({ id: "b", offerId: OFFER_B, funnelKey: "visit_signup" }),
      ],
      set,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.campaignId, r.savedCents]));
    expect(byId.a).toBe(2400);
    expect(byId.b).toBe(900);
  });

  it("a campaign that predates the funnels has no scope and no ceiling", () => {
    const rows = buildControlRows([campaign({ id: "old", funnelKey: null })], undefined);
    expect(rows[0].scope).toBeNull();
    expect(rows[0].savedCents).toBe(0);
  });

  it("orders running first, on the SAVED status so rows do not reshuffle mid-edit", () => {
    const rows = buildControlRows(
      [campaign({ id: "z" }), campaign({ id: "a", status: "stopped" })],
      undefined,
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["z", "a"]);
  });
});

describe("rollupStatus — one word for a scope, exhaustive", () => {
  const row = (running: boolean, id: string) =>
    buildControlRows([campaign({ id, status: running ? "ongoing" : "stopped" })], undefined)[0];

  it("no rows is its own answer, not 'paused'", () => {
    expect(rollupStatus([])).toBe("none");
  });

  it("all running is active", () => {
    expect(rollupStatus([row(true, "a"), row(true, "b")])).toBe("active");
  });

  it("none running is paused", () => {
    expect(rollupStatus([row(false, "a"), row(false, "b")])).toBe("paused");
  });

  it("a MIX is neither — it is partially-paused", () => {
    expect(rollupStatus([row(true, "a"), row(false, "b")])).toBe("partially-paused");
    expect(rollupStatus([row(false, "a"), row(true, "b"), row(false, "c")])).toBe(
      "partially-paused",
    );
  });

  it("every verdict has a label and a tint", () => {
    for (const verdict of ["none", "paused", "partially-paused", "active"] as const) {
      expect(ROLLUP_LABEL[verdict].length).toBeGreaterThan(0);
      expect(ROLLUP_STYLE[verdict].length).toBeGreaterThan(0);
    }
  });

  it("every tint is in the html.dark remapped closed set", () => {
    const globals = read("app/globals.css");
    for (const cls of Object.values(ROLLUP_STYLE)) {
      const bg = cls.split(" ").find((c) => c.startsWith("bg-"))!;
      // gray-100 is a neutral, remapped with the base surface rather than as an
      // accent tint; every accent tint must carry its own rule.
      if (bg === "bg-gray-100") continue;
      expect(globals).toContain(`html.dark .${bg}`);
    }
  });
});

describe("isRunningStatus", () => {
  it("matches campaign-service's own word, case-insensitively", () => {
    expect(isRunningStatus("ongoing")).toBe(true);
    expect(isRunningStatus("Active")).toBe(true);
    expect(isRunningStatus("stopped")).toBe(false);
  });

  it("stays byte-equal with the Campaigns table's pill definition", () => {
    const table = read("components/campaigns/campaigns-table.tsx");
    const lib = read("lib/campaign-controls.ts");
    const set = 'new Set(["active", "running", "ongoing", "live"])';
    expect(table).toContain(set);
    expect(lib).toContain(set);
  });
});

describe("parseDailyBudgetUsd", () => {
  it("blank is zero — the stop, not an error", () => {
    expect(parseDailyBudgetUsd("")).toBe(0);
    expect(parseDailyBudgetUsd("  ")).toBe(0);
  });

  it("whole dollars only", () => {
    expect(parseDailyBudgetUsd("24")).toBe(24);
    expect(parseDailyBudgetUsd("7.5")).toBeNull();
    expect(parseDailyBudgetUsd("-3")).toBeNull();
    expect(parseDailyBudgetUsd("abc")).toBeNull();
  });
});

describe("scopeTotalCents", () => {
  it("adds the rows' own ceilings", () => {
    const set = budgets([
      { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 2400 },
    ]);
    const rows = buildControlRows(
      [campaign({ id: "a" }), campaign({ id: "old", funnelKey: null })],
      set,
    );
    // The unscoped row contributes nothing: it has no ceiling to add.
    expect(scopeTotalCents(rows)).toBe(2400);
  });
});

describe("controlsDiff — only what changed", () => {
  const set = budgets([
    { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 2400 },
  ]);
  const rows = buildControlRows([campaign({ id: "a" })], set);
  const unchanged: Record<string, ControlDraft> = { a: { running: true, budget: "24" } };

  it("an untouched row writes nothing", () => {
    const diff = controlsDiff(rows, unchanged);
    expect(diff.statusWrites).toEqual([]);
    expect(diff.budgetWrites).toEqual([]);
    expect(hasChanges(diff)).toBe(false);
  });

  it("flipping the toggle does NOT restate the amount", () => {
    const diff = controlsDiff(rows, { a: { running: false, budget: "24" } });
    expect(diff.statusWrites).toEqual([{ campaignId: "a", activate: false }]);
    expect(diff.budgetWrites).toEqual([]);
  });

  it("editing the amount does NOT restate the status", () => {
    const diff = controlsDiff(rows, { a: { running: true, budget: "40" } });
    expect(diff.statusWrites).toEqual([]);
    expect(diff.budgetWrites).toEqual([
      {
        campaignId: "a",
        funnelKey: "reply_meeting",
        featureSlug: COLD_EMAIL,
        offerId: OFFER_A,
        cents: 4000,
      },
    ]);
  });

  it("blank writes a real zero", () => {
    const diff = controlsDiff(rows, { a: { running: true, budget: "" } });
    expect(diff.budgetWrites[0].cents).toBe(0);
  });

  it("a non-integer amount is reported, not written", () => {
    const diff = controlsDiff(rows, { a: { running: true, budget: "12.5" } });
    expect(diff.invalidRows).toEqual(["a"]);
    expect(diff.budgetWrites).toEqual([]);
  });

  it("a row with no scope never produces a budget write", () => {
    const old = buildControlRows([campaign({ id: "old", funnelKey: null })], set);
    const diff = controlsDiff(old, { old: { running: false, budget: "99" } });
    expect(diff.budgetWrites).toEqual([]);
    expect(diff.statusWrites).toEqual([{ campaignId: "old", activate: false }]);
  });
});

describe("diffSummary — what Confirm is about to do", () => {
  const set = budgets([
    { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 2400 },
    { funnelKey: "visit_signup", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 1000 },
  ]);
  const rows = buildControlRows(
    [campaign({ id: "a" }), campaign({ id: "b", funnelKey: "visit_signup" })],
    set,
  );

  it("nothing changed means no sentence", () => {
    const diff = controlsDiff(rows, {
      a: { running: true, budget: "24" },
      b: { running: true, budget: "10" },
    });
    expect(diffSummary(rows, diff)).toBeNull();
  });

  it("states the counts and the money, before and after", () => {
    const diff = controlsDiff(rows, {
      a: { running: false, budget: "24" },
      b: { running: true, budget: "20" },
    });
    const summary = diffSummary(rows, diff)!;
    expect(summary).toContain("1 campaign pausing");
    expect(summary).toContain("$34 to $44");
  });

  it("counts restarts and pauses separately", () => {
    const stopped = buildControlRows(
      [campaign({ id: "a", status: "stopped" }), campaign({ id: "b", funnelKey: "visit_signup" })],
      set,
    );
    const diff = controlsDiff(stopped, {
      a: { running: true, budget: "24" },
      b: { running: false, budget: "10" },
    });
    const summary = diffSummary(stopped, diff)!;
    expect(summary).toContain("1 campaign restarting");
    expect(summary).toContain("1 campaign pausing");
  });

  it("nextTotalCents keeps an untouched row's own ceiling", () => {
    const diff = controlsDiff(rows, {
      a: { running: true, budget: "30" },
      b: { running: true, budget: "10" },
    });
    expect(nextTotalCents(rows, diff)).toBe(4000);
  });
});

describe("controlWriteErrorMessage — our copy, never the downstream body", () => {
  it("branches on the status and on the write kind", () => {
    expect(controlWriteErrorMessage(400, "status")).toContain("cannot be restarted");
    expect(controlWriteErrorMessage(400, "budget")).toContain("daily budget was refused");
    expect(controlWriteErrorMessage(409, "budget")).toContain("more than one campaign");
    expect(controlWriteErrorMessage(null, "status")).toContain("Try again");
  });

  it("no em-dash anywhere in the copy this file ships", () => {
    // Every string in this module is read by a person.
    const lib = read("lib/campaign-controls.ts");
    const copy = [...Object.values(ROLLUP_LABEL)];
    for (const s of copy) expect(s).not.toContain("—");
    // The doc comments are internal, so only the string literals are checked.
    const literals = lib.match(/"[^"\n]{12,}"/g) ?? [];
    for (const s of literals) expect(s).not.toContain("—");
  });
});
