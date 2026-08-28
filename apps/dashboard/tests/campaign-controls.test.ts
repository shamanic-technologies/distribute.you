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
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";

/** The channels the environment publishes, as the catalogue builds them. */
const CHANNELS = acquisitionChannelsFromFeatures([
  {
    slug: "sales-cold-email-outreach",
    name: "Sales Cold Email Outreach",
    description: "We email your buyers from our own domains, on your behalf.",
    displayOrder: 1,
    salesFunnels: ["sales_meetings_from_conversation", "website_purchases"],
  },
  {
    slug: "feedback-request-cold-email-outreach",
    name: "Feedback Request Cold Email Outreach",
    description: "We ask your buyers about the problem you solve.",
    displayOrder: 2,
    salesFunnels: ["sales_meetings_from_conversation"],
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Buy the searches your buyers already run.",
    displayOrder: 20,
    salesFunnels: ["sales_meetings_from_website", "website_purchases", "form_magnet"],
  },
]);


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
    createdAt: "2026-05-01T00:00:00.000Z",
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
        campaign({ id: "b", status: "stopped", funnelKey: "visit_signup" }),
      ],
      undefined, CHANNELS,
    );
    expect(rows.map((r) => r.campaignId).sort()).toEqual(["a", "b"]);
    // A stopped campaign has to be in the list, or stopping one from here would
    // be irreversible from the UI.
    expect(rows.find((r) => r.campaignId === "b")!.running).toBe(false);
  });

  it("groups the stored rows of ONE campaign into ONE line", () => {
    // campaign-service mints a fresh row on every workflow change and keeps at
    // most one `ongoing`, so a campaign that has run for months is stored as
    // dozens of rows. Listing them per row showed the same campaign dozens of
    // times, each offering to edit the one ceiling they all share.
    const members = [
      campaign({ id: "live" }),
      ...Array.from({ length: 45 }, (_, i) =>
        campaign({ id: `old-${i}`, status: "stopped" }),
      ),
    ];
    const rows = buildControlRows(members, undefined, CHANNELS, { offerId: OFFER_A });
    expect(rows).toHaveLength(1);
    expect(rows[0].running).toBe(true);
  });

  it("a restart addresses the LIVE row when there is one", () => {
    const rows = buildControlRows(
      [campaign({ id: "old", status: "stopped" }), campaign({ id: "live" })],
      undefined, CHANNELS,
    );
    expect(rows[0].campaignId).toBe("live");
    expect(rows[0].runningCampaignIds).toEqual(["live"]);
  });

  it("with none live it addresses the most RECENT row, not an ancestor", () => {
    // The newest row is the campaign as it last ran; restarting an ancestor
    // would resume a workflow the customer replaced.
    const rows = buildControlRows(
      [
        campaign({ id: "ancient", status: "stopped", createdAt: "2026-04-01T00:00:00.000Z" }),
        campaign({ id: "newest", status: "stopped", createdAt: "2026-06-12T00:00:00.000Z" }),
        campaign({ id: "middle", status: "stopped", createdAt: "2026-05-09T00:00:00.000Z" }),
      ],
      undefined, CHANNELS,
    );
    expect(rows[0].campaignId).toBe("newest");
    expect(rows[0].runningCampaignIds).toEqual([]);
    expect(rows[0].running).toBe(false);
  });

  it("keeps one line per identity, so two funnels stay two rows", () => {
    const rows = buildControlRows(
      [
        campaign({ id: "a1" }),
        campaign({ id: "a2", status: "stopped" }),
        campaign({ id: "b1", funnelKey: "visit_signup" }),
      ],
      undefined, CHANNELS,
      { offerId: OFFER_A },
    );
    expect(rows).toHaveLength(2);
  });

  it("a campaign that predates the funnels names no triple, so it groups alone", () => {
    // It has no ceiling to share, so nothing can be double counted; folding two
    // of them together would hide one campaign behind the other.
    const rows = buildControlRows(
      [campaign({ id: "old1", funnelKey: null }), campaign({ id: "old2", funnelKey: null })],
      undefined, CHANNELS,
    );
    expect(rows).toHaveLength(2);
  });

  it("excludes a campaign whose feature is not an acquisition channel", () => {
    const rows = buildControlRows(
      [campaign({ id: "a" }), campaign({ id: "pr", featureSlug: "pr-expert-quote" })],
      undefined, CHANNELS,
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
      undefined, CHANNELS,
      { offerId: OFFER_A },
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["mine"]);
  });

  it("campaign grain yields exactly one row", () => {
    const rows = buildControlRows(
      [campaign({ id: "a", status: "stopped" }), campaign({ id: "b" })],
      undefined, CHANNELS,
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
      set, CHANNELS,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.campaignId, r.savedCents]));
    expect(byId.a).toBe(2400);
    expect(byId.b).toBe(900);
  });

  it("a campaign that predates the funnels has no scope and no ceiling", () => {
    const rows = buildControlRows([campaign({ id: "old", funnelKey: null })], undefined, CHANNELS);
    expect(rows[0].scope).toBeNull();
    expect(rows[0].savedCents).toBe(0);
  });

  it("orders running first, on the SAVED status so rows do not reshuffle mid-edit", () => {
    const rows = buildControlRows(
      [
        campaign({ id: "z", funnelKey: "visit_signup" }),
        campaign({ id: "a", status: "stopped" }),
      ],
      undefined, CHANNELS,
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["z", "a"]);
  });

  it("narrows to ONE funnel, reading either wire spelling of it", () => {
    const all = [
      campaign({ id: "reply", funnelKey: "reply_meeting" }),
      campaign({ id: "purchase", funnelKey: "visit_signup" }),
    ];
    for (const spelling of ["reply_meeting", "sales_meetings_from_conversation"]) {
      const rows = buildControlRows(all, undefined, CHANNELS, { funnelKey: spelling });
      expect(rows.map((r) => r.campaignId)).toEqual(["reply"]);
    }
  });

  it("the funnel filter composes with the offer filter, never replaces it", () => {
    const rows = buildControlRows(
      [
        campaign({ id: "mine", funnelKey: "reply_meeting", offerId: OFFER_A }),
        campaign({ id: "sibling", funnelKey: "reply_meeting", offerId: OFFER_B }),
      ],
      undefined,
      CHANNELS,
      { offerId: OFFER_A, funnelKey: "reply_meeting" },
    );
    expect(rows.map((r) => r.campaignId)).toEqual(["mine"]);
  });

  it("a campaign that names no funnel belongs to no funnel's list", () => {
    const rows = buildControlRows(
      [campaign({ id: "old", funnelKey: null })],
      undefined,
      CHANNELS,
      { funnelKey: "reply_meeting" },
    );
    expect(rows).toEqual([]);
  });

  it("an unmapped funnel key narrows to nothing rather than throwing", () => {
    expect(() =>
      buildControlRows([campaign({ id: "a" })], undefined, CHANNELS, { funnelKey: "nonsense" }),
    ).not.toThrow();
    expect(buildControlRows([campaign({ id: "a" })], undefined, CHANNELS, { funnelKey: "nonsense" })).toEqual([]);
  });
});

describe("rollupStatus — one word for a scope, exhaustive", () => {
  const row = (running: boolean, id: string) =>
    buildControlRows(
      [campaign({ id, status: running ? "ongoing" : "stopped" })],
      undefined, CHANNELS,
      { campaignId: id },
    )[0];

  it("no rows is its own answer, not 'paused'", () => {
    expect(rollupStatus([])).toBe("none");
  });

  it("all running is active", () => {
    expect(rollupStatus([row(true, "a"), row(true, "b")])).toBe("active");
  });

  it("none running is paused", () => {
    expect(rollupStatus([row(false, "a"), row(false, "b")])).toBe("paused");
  });

  it("a MIX is ACTIVE — one campaign running means the scope is running", () => {
    // There is deliberately no third word. "Partially paused" read as a fault on
    // a brand doing exactly what it meant to: one funnel live, an older one
    // stopped. Which campaigns run is what the rows say, one toggle each.
    expect(rollupStatus([row(true, "a"), row(false, "b")])).toBe("active");
    expect(rollupStatus([row(false, "a"), row(true, "b"), row(false, "c")])).toBe("active");
  });

  it("carries no partially-paused verdict anywhere", () => {
    const lib = read("lib/campaign-controls.ts");
    expect(lib).not.toContain("partially-paused");
    expect(lib).not.toContain("Partially paused");
    expect(Object.keys(ROLLUP_LABEL).sort()).toEqual(["active", "none", "paused"]);
  });

  it("every verdict has a label and a tint", () => {
    for (const verdict of ["none", "paused", "active"] as const) {
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
      set, CHANNELS,
    );
    // The unscoped row contributes nothing: it has no ceiling to add.
    expect(scopeTotalCents(rows)).toBe(2400);
  });

  it("counts ONE ceiling per campaign, not one per stored row", () => {
    // billing keys one ceiling on (funnel, channel, offer). A list per stored row
    // added that same ceiling up once per row: prod read $2,310/day off 46 rows
    // of one campaign whose real ceiling is $50.
    const set = budgets([
      { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 5000 },
    ]);
    const rows = buildControlRows(
      [
        campaign({ id: "live" }),
        ...Array.from({ length: 45 }, (_, i) =>
          campaign({ id: `old-${i}`, status: "stopped" }),
        ),
      ],
      set, CHANNELS,
      { offerId: OFFER_A },
    );
    expect(scopeTotalCents(rows)).toBe(5000);
  });

  it("reproduces the offer that reported this, to the cent", () => {
    // Brand 75d7e3e8 / offer d5ecba00, read from prod: 46 stored rows of one
    // cold-email campaign (1 ongoing) plus one stopped feedback-request campaign,
    // against exactly two billing ceilings — $50 and $10.
    const set = budgets([
      { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 5000 },
      {
        funnelKey: "reply_meeting",
        featureSlug: "feedback-request-cold-email-outreach",
        offerId: null,
        cents: 1000,
      },
    ]);
    const rows = buildControlRows(
      [
        campaign({ id: "live" }),
        ...Array.from({ length: 45 }, (_, i) =>
          campaign({ id: `old-${i}`, status: "stopped" }),
        ),
        campaign({
          id: "feedback",
          status: "stopped",
          featureSlug: "feedback-request-cold-email-outreach",
        }),
      ],
      set, CHANNELS,
      { offerId: OFFER_A },
    );
    expect(rows).toHaveLength(2);
    // $50, not $60: the feedback-request campaign is STOPPED, so its $10 ceiling
    // still exists and nothing will draw on it today. The Overview read `$60 / day`
    // for exactly this brand.
    expect(scopeTotalCents(rows)).toBe(5000);
    // ...and one running campaign makes the offer active, not partially paused.
    expect(rollupStatus(rows)).toBe("active");
  });

  it("leaves a PAUSED campaign's ceiling out — it is money that will not be spent", () => {
    // Pausing is a status, not a zeroed amount, precisely so the figure survives a
    // restart. That is also why it cannot be in a total answering "per day".
    const set = budgets([
      { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 5000 },
      { funnelKey: "visit_signup", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 1000 },
    ]);
    const rows = buildControlRows(
      [
        campaign({ id: "live" }),
        campaign({ id: "paused", status: "stopped", funnelKey: "visit_signup" }),
      ],
      set, CHANNELS,
      { offerId: OFFER_A },
    );
    expect(rows).toHaveLength(2);
    expect(scopeTotalCents(rows)).toBe(5000);
  });

  it("is zero when every campaign is paused, and that is a real answer", () => {
    const set = budgets([
      { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 5000 },
    ]);
    const rows = buildControlRows([campaign({ id: "a", status: "stopped" })], set, CHANNELS, {
      offerId: OFFER_A,
    });
    expect(scopeTotalCents(rows)).toBe(0);
  });
});

/** Drafts written against each row's representative campaign id, keyed by rowId. */
function draftsBy(
  rows: ReturnType<typeof buildControlRows>,
  vals: Record<string, ControlDraft>,
): Record<string, ControlDraft> {
  return Object.fromEntries(rows.map((r) => [r.rowId, vals[r.campaignId]]));
}

describe("controlsDiff — only what changed", () => {
  const set = budgets([
    { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 2400 },
  ]);
  const rows = buildControlRows([campaign({ id: "a" })], set, CHANNELS);
  const unchanged = draftsBy(rows, { a: { running: true, budget: "24" } });

  it("an untouched row writes nothing", () => {
    const diff = controlsDiff(rows, unchanged);
    expect(diff.statusWrites).toEqual([]);
    expect(diff.budgetWrites).toEqual([]);
    expect(hasChanges(diff)).toBe(false);
  });

  it("flipping the toggle does NOT restate the amount", () => {
    const diff = controlsDiff(rows, draftsBy(rows, { a: { running: false, budget: "24" } }));
    expect(diff.statusWrites.map((w) => [w.campaignId, w.activate])).toEqual([["a", false]]);
    expect(diff.budgetWrites).toEqual([]);
  });

  it("editing the amount does NOT restate the status", () => {
    const diff = controlsDiff(rows, draftsBy(rows, { a: { running: true, budget: "40" } }));
    expect(diff.statusWrites).toEqual([]);
    expect(diff.budgetWrites).toEqual([
      {
        rowId: rows[0].rowId,
        funnelKey: "reply_meeting",
        featureSlug: COLD_EMAIL,
        offerId: OFFER_A,
        cents: 4000,
      },
    ]);
  });

  it("blank writes a real zero", () => {
    const diff = controlsDiff(rows, draftsBy(rows, { a: { running: true, budget: "" } }));
    expect(diff.budgetWrites[0].cents).toBe(0);
  });

  it("a non-integer amount is reported, not written", () => {
    const diff = controlsDiff(rows, draftsBy(rows, { a: { running: true, budget: "12.5" } }));
    expect(diff.invalidRows).toEqual([rows[0].rowId]);
    expect(diff.budgetWrites).toEqual([]);
  });

  it("a row with no scope never produces a budget write", () => {
    const old = buildControlRows([campaign({ id: "old", funnelKey: null })], set, CHANNELS);
    const diff = controlsDiff(old, draftsBy(old, { old: { running: false, budget: "99" } }));
    expect(diff.budgetWrites).toEqual([]);
    expect(diff.statusWrites.map((w) => [w.campaignId, w.activate])).toEqual([["old", false]]);
  });

  it("pausing stops EVERY running row of the campaign, not just the one we picked", () => {
    // campaign-service keeps at most one `ongoing` per identity, so this is the
    // defensive branch — but stopping only the row we happened to pick would
    // silently leave a second live if that ever changed.
    const many = buildControlRows(
      [campaign({ id: "live-a" }), campaign({ id: "live-b" }), campaign({ id: "old", status: "stopped" })],
      set, CHANNELS,
    );
    expect(many).toHaveLength(1);
    const diff = controlsDiff(many, { [many[0].rowId]: { running: false, budget: "24" } });
    expect(diff.statusWrites.map((w) => w.campaignId).sort()).toEqual(["live-a", "live-b"]);
    expect(diff.statusWrites.every((w) => !w.activate)).toBe(true);
  });

  it("restarting addresses the representative alone, never every ancestor", () => {
    const stopped = buildControlRows(
      [
        campaign({ id: "newest", status: "stopped", createdAt: "2026-06-12T00:00:00.000Z" }),
        campaign({ id: "older", status: "stopped", createdAt: "2026-05-01T00:00:00.000Z" }),
      ],
      set, CHANNELS,
    );
    const diff = controlsDiff(stopped, { [stopped[0].rowId]: { running: true, budget: "24" } });
    expect(diff.statusWrites.map((w) => [w.campaignId, w.activate])).toEqual([["newest", true]]);
  });
});

describe("diffSummary — what Confirm is about to do", () => {
  const set = budgets([
    { funnelKey: "reply_meeting", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 2400 },
    { funnelKey: "visit_signup", featureSlug: COLD_EMAIL, offerId: OFFER_A, cents: 1000 },
  ]);
  const rows = buildControlRows(
    [campaign({ id: "a" }), campaign({ id: "b", funnelKey: "visit_signup" })],
    set, CHANNELS,
  );

  it("nothing changed means no sentence", () => {
    const diff = controlsDiff(
      rows,
      draftsBy(rows, { a: { running: true, budget: "24" }, b: { running: true, budget: "10" } }),
    );
    expect(diffSummary(rows, diff)).toBeNull();
  });

  it("states the counts and the money, before and after", () => {
    const diff = controlsDiff(
      rows,
      draftsBy(rows, { a: { running: false, budget: "24" }, b: { running: true, budget: "20" } }),
    );
    const summary = diffSummary(rows, diff)!;
    expect(summary).toContain("1 campaign pausing");
    // $34 to $20: b's ceiling rises 10 -> 20, and a's $24 leaves the daily total
    // because it is being PAUSED, though its ceiling is untouched and comes back
    // with it. The line reports what will be spent, not what is configured.
    expect(summary).toContain("$34 to $20");
  });

  it("reports the money moving on a PAUSE alone, with no budget write at all", () => {
    const diff = controlsDiff(
      rows,
      draftsBy(rows, { a: { running: false, budget: "24" }, b: { running: true, budget: "10" } }),
    );
    expect(diff.budgetWrites).toHaveLength(0);
    const summary = diffSummary(rows, diff)!;
    expect(summary).toContain("$34 to $10");
  });

  it("says nothing about money when the edit cannot change what is spent today", () => {
    // Editing a PAUSED campaign's ceiling is a real write and moves nothing today,
    // so the line would otherwise read "$24 to $24".
    const mixed = buildControlRows(
      [
        campaign({ id: "a" }),
        campaign({ id: "b", status: "stopped", funnelKey: "visit_signup" }),
      ],
      set, CHANNELS,
    );
    const diff = controlsDiff(
      mixed,
      draftsBy(mixed, { a: { running: true, budget: "24" }, b: { running: false, budget: "99" } }),
    );
    expect(diff.budgetWrites).toHaveLength(1);
    expect(diffSummary(mixed, diff)).not.toContain("daily budget");
  });

  it("counts restarts and pauses separately", () => {
    const stopped = buildControlRows(
      [campaign({ id: "a", status: "stopped" }), campaign({ id: "b", funnelKey: "visit_signup" })],
      set, CHANNELS,
    );
    const diff = controlsDiff(
      stopped,
      draftsBy(stopped, { a: { running: true, budget: "24" }, b: { running: false, budget: "10" } }),
    );
    const summary = diffSummary(stopped, diff)!;
    expect(summary).toContain("1 campaign restarting");
    expect(summary).toContain("1 campaign pausing");
  });

  it("nextTotalCents keeps an untouched row's own ceiling", () => {
    const diff = controlsDiff(
      rows,
      draftsBy(rows, { a: { running: true, budget: "30" }, b: { running: true, budget: "10" } }),
    );
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
