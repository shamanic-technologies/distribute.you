import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  isMeasuredProjectionRow,
  measuredProjectionRows,
} from "../src/lib/workflow-projection-measured";

/**
 * features-service serves UNMEASURED workflow-projection rows (`measured: false`) so its
 * own serving consumer can reach an ACTIVE workflow that has never spent — the only way
 * such a workflow earns a first run. Those rows carry an EXPLORE ALLOWANCE as their
 * `resolved.costPerOutcomeUsd` (a deliberately low cost floor, not a result), a null
 * grain, an empty `estimatesByGrain` and NO return at all.
 *
 * Every dashboard surface ranks these rows by `resolved.costPerOutcomeUsd` ascending, so
 * an unmeasured row is the cheapest by construction and would take the "Your best model"
 * headline — a bogus cost above a blank return, and a grain label rendered off a null.
 * They are dropped at the single reader boundary instead.
 *
 * `workflow-projection-measured.ts` is alias-free, so these are REAL unit tests. The
 * reader-side assertions are source-substring: `api.ts` pulls Clerk + the proxy and
 * cannot be imported under vitest (no `@` alias in this repo).
 */

const apiSrc = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

/** A measured brand-level row, shaped like the wire. */
const measured = {
  audienceId: null,
  workflow: { workflowDynastySlug: "dawn", workflowDynastyName: "Dawn" },
  measured: true,
  estimatesByGrain: {
    brand: {
      evidence: { spentUsd: 400, observedContacted: 900, observedClicks: 12, observedPositiveReplies: 3 },
      unitCosts: { costPerClickUsd: 33, costPerPositiveReplyUsd: 133, costPerContactedUsd: 0.44 },
      projected: {
        costPerSignupUsd: null,
        costPerPaidClientUsd: 337,
        costPerMeetingBookedUsd: 337,
        roiMultiple: 2.4,
        cacPct: 41,
      },
    },
  },
  resolved: {
    grain: "brand",
    costPerClickUsd: 33,
    costPerOutcomeUsd: 337,
    costPerPaidClientUsd: 337,
    costPerMeetingBookedUsd: 337,
    roiMultiple: 2.4,
    cacPct: 41,
  },
};

/** An unmeasured row: the explore allowance, no grain, no return, no evidence. */
const unmeasured = {
  audienceId: null,
  workflow: { workflowDynastySlug: "unproven", workflowDynastyName: "Unproven" },
  measured: false,
  estimatesByGrain: {},
  resolved: {
    grain: null,
    costPerClickUsd: 0.44,
    costPerOutcomeUsd: 0.44,
    costPerPaidClientUsd: null,
    costPerMeetingBookedUsd: null,
    roiMultiple: null,
    cacPct: null,
  },
};

/** Today's wire: no `measured` key at all. */
const legacy = { ...measured } as Record<string, unknown>;
delete legacy.measured;

describe("isMeasuredProjectionRow", () => {
  it("keeps a row the producer states as measured", () => {
    expect(isMeasuredProjectionRow(measured)).toBe(true);
  });

  it("drops a row the producer states as unmeasured", () => {
    expect(isMeasuredProjectionRow(unmeasured)).toBe(false);
  });

  it("keeps a row carrying no flag — every row served today, so this is a no-op", () => {
    expect(isMeasuredProjectionRow(legacy)).toBe(true);
  });

  it("only an explicit false drops a row — a null / absent / truthy flag does not", () => {
    expect(isMeasuredProjectionRow({ measured: null })).toBe(true);
    expect(isMeasuredProjectionRow({ measured: undefined })).toBe(true);
    expect(isMeasuredProjectionRow({})).toBe(true);
    expect(isMeasuredProjectionRow("not-an-object")).toBe(true);
  });
});

describe("measuredProjectionRows — the mixed payload features-service#821 introduces", () => {
  it("returns exactly the rows a payload without the unmeasured ones would carry", () => {
    const mixed = [measured, unmeasured, legacy];
    expect(measuredProjectionRows(mixed)).toEqual([measured, legacy]);
  });

  it("the cheapest SURVIVING row is the measured one, so no argmin can pick the allowance", () => {
    // The allowance (0.44) is an order of magnitude under the real cost (337), which is
    // exactly why an unfiltered argmin would crown the unproven workflow.
    const rows = measuredProjectionRows([measured, unmeasured]) as typeof measured[];
    const cheapest = rows.reduce((a, b) =>
      (a.resolved.costPerOutcomeUsd ?? Infinity) <= (b.resolved.costPerOutcomeUsd ?? Infinity) ? a : b,
    );
    expect(cheapest.workflow.workflowDynastySlug).toBe("dawn");
    expect(cheapest.resolved.costPerOutcomeUsd).toBe(337);
  });

  it("no behaviour change when every row is measured", () => {
    const rows = [measured, legacy];
    expect(measuredProjectionRows(rows)).toEqual(rows);
  });

  it("every row unmeasured yields none — a no-data state, never a figure off an allowance", () => {
    expect(measuredProjectionRows([unmeasured, { ...unmeasured, audienceId: "aud-1" }])).toEqual([]);
  });

  it("passes a non-array through untouched so the schema behind it still fails loud", () => {
    expect(measuredProjectionRows(null)).toBe(null);
    expect(measuredProjectionRows("nope")).toBe("nope");
  });
});

describe("the filter runs at the ONE reader boundary", () => {
  it("the ladder response schema preprocesses its rows through the helper", () => {
    expect(apiSrc).toContain(
      "rows: z.preprocess(measuredProjectionRows, z.array(WorkflowProjectionRowSchema))",
    );
  });

  it("api.ts imports the helper from the alias-free module", () => {
    expect(apiSrc).toContain(
      'import { measuredProjectionRows } from "./workflow-projection-measured"',
    );
  });

  it("no surface re-derives the check — the reader is the only place it lives", () => {
    const dir = path.join(__dirname, "../src");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf-8");
          if (/\.measured\b|measured === false|measured !== false/.test(src)) hits.push(full);
        }
      }
    };
    walk(dir);
    expect(hits.map((h) => path.relative(dir, h)).sort()).toEqual([
      // A DIFFERENT producer's field under the same name: features-service's
      // channel-funnel price list marks each (channel, funnel) pair `measured`, meaning
      // the fleet has spent enough through it to state a price. Nothing to do with a
      // workflow projection row, so this file is not a second copy of the check below —
      // it just happens to read a word the scan cannot tell apart. A NEW file matching
      // still fails, which is the point.
      "lib/funnel-leg-price.ts",
      "lib/workflow-projection-measured.ts",
    ]);
  });
});
