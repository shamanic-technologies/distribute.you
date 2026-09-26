import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  daysSinceChanged,
  dueCountForOffer,
  formatReward,
  dueTaskForOffer,
  type RewardTask,
} from "../src/lib/reward-tasks";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** `reward-tasks.ts` is alias-free on purpose, so these are REAL unit tests.
 *  Adding an `@/…` import turns every case below into a resolution failure. */

const NOW = new Date("2026-09-17T12:00:00.000Z");

function task(over: Partial<RewardTask> = {}): RewardTask {
  return {
    taskKey: "sales_funnel_refresh",
    scope: {
      type: "sales_funnel",
      brandId: "b1",
      offerId: "o1",
    },
    rewardCents: 100,
    due: true,
    dueAt: "2026-08-18T12:00:00.000Z",
    lastCompletedAt: null,
    completedCount: 0,
    contentChangedAt: "2026-07-19T12:00:00.000Z",
    contentChangedProvenance: "observed",
    ...over,
  };
}

describe("dueTaskForOffer", () => {
  it("finds a DUE task on this offer, whichever funnel it belongs to", () => {
    const t = task();
    expect(dueTaskForOffer([t], "o1")).toBe(t);
  });

  it("never returns another OFFER's task", () => {
    expect(dueTaskForOffer([task({ scope: { ...task().scope, offerId: "o2" } })], "o1")).toBeNull();
  });

  it("answers null when nothing is due", () => {
    expect(dueTaskForOffer([task({ due: false })], "o1")).toBeNull();
    expect(dueTaskForOffer([], "o1")).toBeNull();
  });
});

describe("dueCountForOffer", () => {
  it("reads the served count", () => {
    expect(dueCountForOffer([{ offerId: "o1", dueCount: 2, taskCount: 3 }], "o1")).toBe(2);
  });

  it("reads a served ZERO as zero, which is a measured answer", () => {
    expect(dueCountForOffer([{ offerId: "o1", dueCount: 0, taskCount: 3 }], "o1")).toBe(0);
  });

  it("answers NULL for an offer the roll-up never mentions, not zero", () => {
    // "We were not told" and "nothing is due" are different statements, and a
    // fabricated zero reads exactly like a measured one.
    expect(dueCountForOffer([], "o1")).toBeNull();
    expect(dueCountForOffer([{ offerId: "o2", dueCount: 4, taskCount: 4 }], "o1")).toBeNull();
  });
});

describe("daysSinceChanged", () => {
  it("counts whole days when the ledger OBSERVED the change itself", () => {
    expect(daysSinceChanged(task(), NOW)).toBe(60);
  });

  it("refuses a day count when the baseline is the producer's timestamp", () => {
    // That timestamp also moves when a funnel is merely switched off and back
    // on, so an age derived from it is a number we cannot stand behind. The
    // band then says the refresh is owed without claiming to know for how long.
    expect(daysSinceChanged(task({ contentChangedProvenance: "producer_ts" }), NOW)).toBeNull();
  });

  it("refuses an unparseable or future instant rather than printing a wrong age", () => {
    expect(daysSinceChanged(task({ contentChangedAt: "not-a-date" }), NOW)).toBeNull();
    expect(daysSinceChanged(task({ contentChangedAt: "2027-01-01T00:00:00.000Z" }), NOW)).toBeNull();
  });

  it("floors rather than rounds, so it never overstates the age", () => {
    expect(daysSinceChanged(task({ contentChangedAt: "2026-09-16T00:00:01.000Z" }), NOW)).toBe(1);
  });
});

describe("formatReward", () => {
  it("renders whole dollars", () => {
    expect(formatReward(100)).toBe("$1");
    expect(formatReward(500)).toBe("$5");
  });
});

describe("the band", () => {
  const band = read("components/rewards/reward-task-band.tsx");

  it("renders NOTHING when there is nothing to do", () => {
    // Same shape as the learning band and the hold band above it: a surface
    // that names an outcome must disappear on that outcome.
    expect(band).toContain("if (!task || !task.due) return null;");
  });

  it("reads the day count through the rule, never re-deriving one", () => {
    expect(band).toContain("daysSinceChanged(task, now)");
    expect(band).not.toContain("Date.parse");
    expect(band).not.toContain("86_400_000");
  });

  it("states the reward from the SERVED amount, never a hardcoded dollar", () => {
    expect(band).toContain("formatReward(task.rewardCents)");
    expect(band).not.toMatch(/\$1\b(?![,\d])/);
  });

  it("wears the brand RAMP, never a literal hex, so it rotates with the tint", () => {
    expect(band).toContain("border-brand-200");
    expect(band).toContain("bg-brand-50");
    expect(band).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(band).not.toMatch(/\b(bg|text|border)-\[#/);
  });

  it("every class it wears is remapped for the dark surface, tinted and not", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const cls of ["bg-brand-50", "border-brand-200", "text-brand-700", "text-brand-800"]) {
      expect(css).toContain(`html.dark .${cls}`);
      expect(css).toContain(`html.dark[data-brand-tint] .${cls}`);
    }
  });

  it("carries no em-dash in the copy a customer reads", () => {
    // Top AI-tell, banned repo-wide in user-facing strings. Comments are exempt,
    // so the check is scoped to the render block.
    const render = band.slice(band.indexOf("return ("));
    expect(render).not.toContain("—");
  });

  it("uses a full-perimeter 1px border, never a side accent", () => {
    // Side/top border accents above 1px are banned repo-wide as a generic-design
    // tell.
    expect(band).not.toMatch(/border-(l|r|t)-\d/);
    expect(band).toMatch(/\bborder border-brand-200\b/);
  });
});

describe("the call sites", () => {
  // The offer Overview is the brand page component, scoped by the route.
  const offer = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const pill = read("components/rewards/reward-credits-pill.tsx");
  const hook = read("lib/use-reward-tasks.ts");
  const api = read("lib/api.ts");

  it("is MOUNTED on the offer Overview — a band nothing renders is the feature absent", () => {
    expect(offer).toContain("<RewardTaskBand");
    expect(offer).toContain("task={rewardTask}");
    expect(offer).toContain("settingsHref={`${basePath}/settings`}");
  });

  it("sits ABOVE the learning band, because it is the actionable one", () => {
    expect(offer.indexOf("<RewardTaskBand")).toBeLessThan(offer.lastIndexOf("<ScopeLearningBand"));
  });

  it("selects the task through the shared rule, never a local match", () => {
    expect(offer).toContain("dueTaskForOffer(");
    expect(offer).not.toMatch(/tasks.*\.find\(/);
  });

  it("reads ONE brand-wide key everywhere, so no two surfaces can disagree", () => {
    expect(hook).toContain('["rewardTasks", brandId ?? "none"]');
    for (const src of [offer, pill]) expect(src).toContain("useBrandRewardTasks(");
    // Nobody may build the key by hand beside the hook.
    for (const src of [offer, pill]) expect(src).not.toContain('"rewardTasks",');
  });

  it("badges the top-bar pill only on a BRAND route, and only when something is due", () => {
    // A count of tasks the reader cannot act on from where they are is a nag.
    expect(pill).toContain('pathname.split("/")[4] === "brands"');
    expect(pill).toContain("{dueCount > 0 && (");
  });

  it("reads the gateway path api-service actually deployed", () => {
    expect(api).toContain("`/brands/${brandId}/reward-tasks`");
  });

  it("declares the producer vocabularies as plain strings, never a closed enum", () => {
    // Both can grow; a reader that closes the set throws the page the day it does.
    const block = api.slice(api.indexOf("const RewardTaskWireSchema"), api.indexOf("const RewardRollupEntrySchema"));
    expect(block).toContain("contentChangedProvenance: z.string()");
    expect(block).not.toContain("z.enum");
  });

  it("declares a required-and-nullable field NULLABLE, not optional", () => {
    // `.optional()` refuses exactly the body the null was written for.
    const block = api.slice(api.indexOf("const RewardTaskWireSchema"), api.indexOf("const RewardRollupEntrySchema"));
    expect(block).toContain("lastCompletedAt: z.string().nullable()");
  });

  it("is an allowlisted persist root, or every surface cold-fetches on each visit", () => {
    expect(read("lib/persist-cache.ts")).toContain('"rewardTasks",');
  });
});
