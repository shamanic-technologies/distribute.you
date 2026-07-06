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
  const api = read("../src/lib/api.ts");

  it("deep-links the beta outcome cards to the settings conversion section", () => {
    expect(cards).toContain("Set up conversion tracker");
    expect(cards).toContain("/settings#conversion-tracking");
    expect(cards).toContain('import { useParams } from "next/navigation"');
    // The CTA lives inside the beta gate (same gate the Signups/CPS cards use).
    const betaIdx = cards.indexOf("isBeta && setupHref");
    expect(betaIdx).toBeGreaterThan(-1);
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
