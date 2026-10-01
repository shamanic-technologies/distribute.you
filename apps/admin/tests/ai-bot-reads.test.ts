import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_CATEGORIES,
  AI_CATEGORY_MEANING,
  BotTrafficSchema,
  addDays,
  aiSeries,
  botTrafficWindows,
  capturedDays,
  categoryTotal,
  windowChangePct,
  type BotTraffic,
} from "../src/lib/bot-traffic";

function body(days: Array<[string, Record<string, number> | null]>, totals: Record<string, number>): BotTraffic {
  return BotTrafficSchema.parse({
    host: "distribute.you",
    from: days[0][0],
    to: days[days.length - 1][0],
    categories: Object.keys(totals),
    days: days.map(([date, requests]) => ({ date, captured: requests !== null, requests })),
    totals: Object.entries(totals).map(([category, requests]) => ({
      category,
      requests,
      topBots: category === "AI Assistant" ? [{ botName: "ChatGPT-User", requests }] : [],
    })),
  });
}

const week = (start: string, requests: Record<string, number> | null) =>
  Array.from({ length: 7 }, (_, i) => [addDays(start, i), requests] as [string, Record<string, number> | null]);

describe("bot-traffic model", () => {
  it("asks for yesterday-ending windows", () => {
    const w = botTrafficWindows(new Date("2026-09-29T12:00:00Z"));
    expect(w.last7).toEqual({ from: "2026-09-22", to: "2026-09-28" });
    expect(w.prior7).toEqual({ from: "2026-09-15", to: "2026-09-21" });
    expect(w.history).toEqual({ from: "2026-07-01", to: "2026-09-28" });
  });

  it("reads served totals, 0 for an unlisted category", () => {
    const b = body(week("2026-09-22", { "AI Assistant": 3 }), { "AI Assistant": 21 });
    expect(categoryTotal(b, "AI Assistant")).toBe(21);
    expect(categoryTotal(b, "AI Crawler")).toBe(0);
  });

  it("states a change only between two fully captured windows", () => {
    const cur = body(week("2026-09-22", { "AI Assistant": 3 }), { "AI Assistant": 30 });
    const prev = body(week("2026-09-15", { "AI Assistant": 2 }), { "AI Assistant": 20 });
    expect(windowChangePct(cur, prev, "AI Assistant")).toBe(50);
    const partial = body([...week("2026-09-15", { "AI Assistant": 2 }).slice(0, 6), ["2026-09-21", null]], { "AI Assistant": 12 });
    expect(capturedDays(partial)).toBe(6);
    expect(windowChangePct(cur, partial, "AI Assistant")).toBeNull();
    const zero = body(week("2026-09-15", {}), { "AI Assistant": 0 });
    expect(windowChangePct(cur, zero, "AI Assistant")).toBeNull();
  });

  it("draws uncaptured days as gaps, never zeros, from the first captured day", () => {
    const b = body(
      [
        ["2026-09-20", null],
        ["2026-09-21", { "AI Assistant": 4, "AI Search": 1, "AI Crawler": 9 }],
        ["2026-09-22", null],
        ["2026-09-23", { "AI Assistant": 0 }],
      ],
      { "AI Assistant": 4 },
    );
    const s = aiSeries(b);
    expect(s.map((p) => p.date)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(s[1]["AI Assistant"]).toBeNull();
    expect(s[2]["AI Search"]).toBe(0);
  });

  it("explains every category in plain words, without em-dash", () => {
    for (const c of AI_CATEGORIES) {
      expect(AI_CATEGORY_MEANING[c].length).toBeGreaterThan(20);
      expect(AI_CATEGORY_MEANING[c]).not.toContain("—");
    }
  });
});

describe("metrics page wiring", () => {
  const root = resolve(__dirname, "..");
  const page = readFileSync(resolve(root, "src/app/(authed)/(dashboard)/metrics/page.tsx"), "utf8");
  const card = readFileSync(resolve(root, "src/components/ai-bot-reads-card.tsx"), "utf8");
  const lib = readFileSync(resolve(root, "src/lib/bot-traffic.ts"), "utf8");

  it("reads cloudflare-service once per window and renders the card on the visitors tab", () => {
    expect(page).toContain("fetchBotTraffic({ ...w.last7, topBots: 5 })");
    expect(page).toContain("fetchBotTraffic(w.prior7)");
    expect(page).toContain("fetchBotTraffic(w.history)");
    expect(page).toContain("<AiBotReadsCard data={aiBotReads} error={aiBotReadsError} />");
  });

  it("says human visits exclude robots", () => {
    expect(page).toContain("robots such as email link scanners are excluded");
  });

  it("reads on the compose network with the service key, failing loud", () => {
    expect(lib).toContain("process.env.CLOUDFLARE_SERVICE_URL");
    expect(lib).toContain('"x-api-key": key');
    expect(lib).toContain("throw new Error(`[bot-traffic] cloudflare-service answered");
  });

  it("sums nothing in the card: totals are the producer's", () => {
    expect(card).not.toContain(".reduce(");
    expect(card).not.toContain("—");
  });
});
