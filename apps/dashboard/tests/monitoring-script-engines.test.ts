import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ScriptEnginesSchema, boardBroken, chartScripts, scriptName, shareBars, splitScripts } from "../src/lib/monitoring/script-engines";

// SCRIPT-VALUE-RATING-1113-MON-DASH (owner 2026-11-13 « un pick = toujours un script »): Monitoring > Scripts per Engine
// replaces « LLMs per Engine ». Per Engine, the scripts that compete, the Rating's favourite today and what it rests on.

const script = (dyn: string, over: Record<string, unknown> = {}) => ({
  scriptDynasty: dyn,
  runnable: true,
  version: 3,
  shareOfDrawsPct: 40,
  runs: 120,
  reached: [{ outcome: "positive_reply", runs: 2, creditUsd: 40 }, { outcome: null, runs: 118, creditUsd: 0 }],
  spentUsd: 6,
  costPerRunUsd: 0.05,
  valuePerRunUsd: 0.6,
  valuePerDollar: 12.5,
  valuePerDollarUnavailableReason: null,
  llms: [{ place: null, provider: "anthropic", model: "claude-sonnet-5-5" }],
  templates: [{ place: "writer", templateDynastySlug: "cold-intro" }],
  runsByDay: [{ day: "2026-11-13", runs: 4, spentUsd: 0.2 }],
  ...over,
});
const scripts = [
  ...Array.from({ length: 10 }, (_, i) => script(`email_sent/s${i}`, { shareOfDrawsPct: 10 - i })),
  script("email_sent/old", { runnable: false, version: null, shareOfDrawsPct: null }),
];
const body = {
  ledgerBuiltAt: "2026-11-14T08:00:00.000Z",
  computedAt: "2026-11-14T08:05:00.000Z",
  draws: 1000,
  health: { broken: false, reason: null },
  engines: [
    {
      outcome: "email_sent",
      outcomeValueUsd: 0.4,
      outcomeValueSource: "measured",
      basis: "value_per_dollar",
      favourite: "email_sent/s0",
      runnableScripts: 10,
      runs: 1320,
      scripts,
      drawShareHistory: [
        { day: "2026-11-13", shares: [{ scriptDynasty: "email_sent/s0", sharePct: 50 }, { scriptDynasty: "email_sent/s9", sharePct: 30 }, { scriptDynasty: "email_sent/s8", sharePct: 20 }] },
      ],
    },
  ],
};

describe("Monitoring > Scripts per Engine reader", () => {
  const board = ScriptEnginesSchema.parse(body);
  const e = board.engines[0];

  it("parses the served body", () => {
    expect(e.scripts).toHaveLength(11);
  });

  it("is red only when the served health says broken; « being built » is normal", () => {
    expect(boardBroken({ state: "ready", board })).toBe(false);
    expect(boardBroken({ state: "ready", board: ScriptEnginesSchema.parse({ ...body, health: { broken: true, reason: "board_not_rebuilt" } }) })).toBe(true);
    expect(boardBroken({ state: "building" })).toBe(false);
  });

  it("shows the top runnable scripts, folds the rest, retired at the bottom, served order kept", () => {
    const { top, more, retired } = splitScripts(e);
    expect(top.map((s) => s.scriptDynasty)).toEqual(Array.from({ length: 8 }, (_, i) => `email_sent/s${i}`));
    expect(more.map((s) => s.scriptDynasty)).toEqual(["email_sent/s8", "email_sent/s9"]);
    expect(retired.map((s) => s.scriptDynasty)).toEqual(["email_sent/old"]);
  });

  it("charts the first scripts one by one and groups the rest's served shares as Other", () => {
    const charted = chartScripts(e);
    expect(charted).toEqual(["email_sent/s0", "email_sent/s1", "email_sent/s2", "email_sent/s3"]);
    expect(shareBars(e, charted)).toEqual([{ day: "2026-11-13", parts: [50, 0, 0, 0], other: 50 }]);
  });

  it("names a script by its dynasty without the Engine prefix", () => {
    expect(scriptName("email_sent/cold-intro", "email_sent")).toBe("cold-intro");
    expect(scriptName("other/x", "email_sent")).toBe("other/x");
  });

  it("is wired: page registered, hub tile, reader on the staff gateway path with the 503 read as building", () => {
    const page = readFileSync("src/components/v2/monitoring-page.tsx", "utf8");
    expect(page).toContain('"ai/scripts": { section: "ai"');
    expect(page).toContain('view.page === "ai/scripts" && <ScriptEnginesPage />');
    expect(page).toContain('<ScriptEnginesTile href={href("ai/scripts")} />');
    const api = readFileSync("src/lib/api.ts", "utf8");
    expect(api).toContain('STAFF_SCRIPT_ENGINES_PATH = "/features/research/script-engines"');
    expect(api).toContain("err.status === 503 && err.body?.reason === SCRIPT_ENGINES_NOT_BUILT_YET");
    const comp = readFileSync("src/components/v2/monitoring-script-engines.tsx", "utf8");
    expect(comp).not.toContain(".sort(");
    expect(comp).toContain("Rating score (value per $)");
    expect(comp).not.toMatch(/\bROI\b|Favourite LLM/);
    expect(comp).toContain('kind="llm" name={name}');
  });

  it("leaves no reader of the retired LLM pick in the dashboard", () => {
    const hits = execSync('git grep -l "engine-llms\\|EngineLlms\\|staffEngineLlms" -- src tests || true', { encoding: "utf8" }).trim();
    expect(hits.split("\n").filter((f) => f && !f.endsWith("monitoring-script-engines.test.ts"))).toEqual([]);
  });
});
