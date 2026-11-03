import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OptOutComparisonSchema, optOutView } from "../src/lib/monitoring/sending";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const prod = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "ops-seed-opt-out-prod-2026-11-03.json"), "utf8"));
const cell = (seeds: number, inbox: number, spam: number) => ({ seeds, inbox, spam, found: inbox + spam, inboxPct: inbox + spam ? Math.round((inbox * 1000) / (inbox + spam)) / 10 : null });

// A measured state: every option past its Google sample, "Your mailbox only" served as the winner.
const measured = {
  ...prod(),
  decision: { variant: "mailbox_only", reason: "measured", scoredProviders: ["google"], scores: { tracker_link: 61.2, mailbox_only: 88.4, none: 80.1 } },
  variants: [
    { variant: "none", google: cell(760, 600, 149), microsoft: cell(0, 0, 0), microsoftConsumer: cell(0, 0, 0) },
    { variant: "tracker_link", google: cell(760, 450, 285), microsoft: cell(120, 60, 40), microsoftConsumer: cell(0, 0, 0) },
    { variant: "mailbox_only", google: cell(760, 650, 85), microsoft: cell(0, 0, 0), microsoftConsumer: cell(0, 0, 0) },
  ],
};

describe("Monitoring > opt-out header test (UNSUB-3WAY-1103)", () => {
  it("today's prod read: no seed yet, the tracker link is the default, waiting for the first test", () => {
    const v = optOutView(OptOutComparisonSchema.parse(prod()));
    expect(v.current).toBe("tracker_link");
    expect(v.measured).toBe(false);
    expect(v.anySeed).toBe(false);
    expect(v.options.map((o) => o.name)).toEqual(["Tracker link", "Your mailbox only", "No unsubscribe header"]);
    expect(v.options.filter((o) => o.current).map((o) => o.variant)).toEqual(["tracker_link"]);
  });

  it("a measured winner reads at a glance: the served winner, in the chart's order whatever the served order", () => {
    const v = optOutView(OptOutComparisonSchema.parse(measured));
    expect(v.measured).toBe(true);
    expect(v.current).toBe("mailbox_only");
    expect(v.options.map((o) => o.variant)).toEqual(["tracker_link", "mailbox_only", "none"]);
    const winner = v.options.find((o) => o.current)!;
    expect(winner.name).toBe("Your mailbox only");
    expect(winner.score).toBe(88.4);
    expect(winner.google.inboxPct).toBe(88.4);
  });

  it("an option the dashboard does not know yet still shows, under its raw key", () => {
    const extra = { ...measured, variants: [...measured.variants, { variant: "footer_link", google: cell(0, 0, 0), microsoft: cell(0, 0, 0), microsoftConsumer: cell(0, 0, 0) }] };
    const v = optOutView(OptOutComparisonSchema.parse(extra));
    expect(v.options.map((o) => o.name).at(-1)).toBe("footer_link");
  });

  it("the chart sits on the Inbox providers page beside the placement charts, its tile on the hub, red only when unreadable", () => {
    const sending = read("components/v2/monitoring-sending.tsx");
    const page = sending.slice(sending.indexOf("export function InboxProvidersPage("));
    expect(page.indexOf("<OptOutChart />")).toBeGreaterThan(page.indexOf("<ProviderChart"));
    const chart = sending.slice(sending.indexOf("export function OptOutChart("), sending.indexOf("export function OptOutTile("));
    expect(chart.match(/RED/g)?.length).toBe(1);
    expect(chart).toContain("Waiting for the first test.");
    expect(read("components/v2/monitoring-page.tsx")).toContain('<OptOutTile href={href("emails/inbox-providers")} />');
    expect(read("lib/api.ts")).toContain('seedOptOut: "/instantly/ops/seed-placement/opt-out"');
  });
});
