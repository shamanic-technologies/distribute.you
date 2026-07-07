import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("conversion tracker setup CTA + live status", () => {
  const cards = read("../src/components/revenue/outreach-stat-cards.tsx");
  const settings = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );
  const card = read("../src/components/settings/brand-conversion-tracking-card.tsx");
  const button = read("../src/components/revenue/conversion-tracker-button.tsx");
  const api = read("../src/lib/api.ts");

  it("deep-links the beta outcome cards to the settings conversion section", () => {
    // The CTA label lives on the shared ghost button, not inline in the cards.
    expect(button).toContain("Set up conversion tracker");
    expect(cards).toContain("/settings#conversion-tracking");
    expect(cards).toContain('import { useParams } from "next/navigation"');
    // The button renders IN PLACE OF the value on EVERY untracked outcome card
    // (via ScoreCard's `action` slot) whenever the tracker is not live —
    // `trackerButton` is null once live, so a live tracker hides the CTA and the
    // real count/cost shows. Both beta cards carry the CTA, not just one.
    expect(cards).toContain("action={trackerButton ?? undefined}");
    // ...on both the outcome COUNT card and its COST card.
    expect(cards.match(/action=\{trackerButton \?\? undefined\}/g)?.length).toBe(2);
    // Built only when the brand-scoped href resolves AND the tracker is not yet
    // live — once lead-service reports live/live_waiting the CTA must stop, so the
    // stat cards never nag "set up" while Brand Settings shows "Tracker live".
    expect(cards).toContain("setupHref && !trackerLive ?");
    expect(cards).toContain('conversionToken?.status === "live"');
    expect(cards).toContain('conversionToken?.status === "live_waiting"');
    expect(cards).toContain('["brandConversionToken", brandId]');
    // The outcome cards that host the CTA render only when the goal has an outcome
    // step (goal-steps single source) — not the old user-level isBeta gate.
    expect(cards).toContain("outcomeStep && outcome");
    expect(cards).not.toContain("isBeta &&");
  });

  it("renders the setup CTA as a discreet ghost button (transparent, 1px border, near-black text)", () => {
    expect(button).toContain("ConversionTrackerButton");
    expect(button).toContain("border border-gray-300");
    expect(button).toContain("text-gray-900");
    expect(button).toContain("hover:bg-gray-50");
  });

  it("gives the Conversion Tracking settings section an anchor to scroll to", () => {
    expect(settings).toContain('id="conversion-tracking"');
    expect(settings).toContain("scroll-mt");
  });

  it("fires a page-load liveness ping in the browser snippet", () => {
    expect(card).toContain('event: "ping"');
    // The ping must NOT carry conversion identity fields — liveness only.
    expect(card).toContain("confirm your tracker is live");
  });

  it("renders a server-derived live status pill (no client status computation)", () => {
    expect(card).toContain("function StatusPill");
    expect(card).toContain("live_waiting");
    expect(card).toContain("Not set up yet");
    expect(card).toContain("Tracker live");
    // Reads the producer fields, never computes the status string itself.
    expect(card).toContain(
      "const { status, lastEventAt, lastPingAt, eventTypesSeen } = data",
    );
    expect(card).toContain("<StatusPill data={data} />");
  });

  it("declares the new token fields OPTIONAL so the dashboard ships ahead of lead-service", () => {
    expect(api).toContain('status: z.enum(["not_set_up", "live_waiting", "live"]).optional()');
    expect(api).toContain("lastEventAt: z.string().nullish()");
    expect(api).toContain("lastPingAt: z.string().nullish()");
    expect(api).toContain("eventTypesSeen: z.array(z.string()).optional()");
  });
});
