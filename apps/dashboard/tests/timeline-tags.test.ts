import { describe, expect, it } from "vitest";
import { timelineTag } from "../src/lib/timeline-tags";

const ev = (step: string | null) => ({ kind: "event", direction: null, event: step ? { step } : null });
const msg = (direction: string | null) => ({ kind: "message", direction, event: null });

describe("Unibox timeline tags (owner 2026-10-08)", () => {
  it("colours a message by who wrote it", () => {
    expect(timelineTag(msg("outbound"))).toEqual({ label: "Sent", tone: "neutral", icon: "sent" });
    expect(timelineTag(msg("inbound"))).toEqual({ label: "Received", tone: "reply", icon: "reply" });
    expect(timelineTag(msg(null)).tone).toBe("neutral");
  });
  it("colours an event by its family: won, hot, lost", () => {
    expect(timelineTag(ev("sale"))).toMatchObject({ label: "Sale", tone: "won", icon: "money" });
    expect(timelineTag(ev("payment")).tone).toBe("won");
    expect(timelineTag(ev("meeting_booked"))).toMatchObject({ label: "Meeting booked", tone: "hot", icon: "meeting" });
    expect(timelineTag(ev("visit"))).toMatchObject({ label: "Website visit", tone: "hot", icon: "visit" });
    expect(timelineTag(ev("deal_lost")).tone).toBe("lost");
    expect(timelineTag(ev("subscription_canceled")).tone).toBe("lost");
  });
  it("never paints a payment attempt green unless the money arrived (UNIBOX-PAYMENT-REFUSED-1028)", () => {
    expect(timelineTag(ev("payment"))).toMatchObject({ label: "Payment received", tone: "won" });
    expect(timelineTag(ev("payment_refused"))).toMatchObject({ label: "Payment refused", tone: "lost", icon: "money" });
    expect(timelineTag(ev("payment_disputed")).tone).toBe("lost");
    expect(timelineTag(ev("refund_failed")).tone).toBe("lost");
    expect(timelineTag(ev("payment_pending")).tone).toBe("neutral");
    expect(timelineTag(ev("payment_attempt")).tone).toBe("neutral");
    expect(timelineTag(ev("stripe_customer_created")).tone).toBe("neutral");
  });
  it("names a client's account actions (CLIENT-ACTIVITY-1030)", () => {
    expect(timelineTag(ev("campaign_created"))).toMatchObject({ label: "Campaign created", tone: "won" });
    expect(timelineTag(ev("campaign_updated"))).toMatchObject({ label: "Campaign edited", tone: "neutral" });
    expect(timelineTag(ev("campaign_paused")).tone).toBe("lost");
    expect(timelineTag(ev("campaign_budget_changed"))).toMatchObject({ label: "Budget changed", tone: "hot", icon: "money" });
  });
  it("keeps a step it does not know, in its producer word, neutral", () => {
    expect(timelineTag(ev("brand_new_step"))).toEqual({ label: "Brand new step", tone: "neutral", icon: "dot" });
    expect(timelineTag(ev(null)).label).toBe("Event");
  });
});

describe("Unibox search runs the whole width, above both cards (owner 2026-10-08)", () => {
  it("renders the search before the cards grid, not inside the People card", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/components/v2/integrations-conversations.tsx", import.meta.url), "utf8");
    const search = src.indexOf('placeholder="Search by name or email"');
    const grid = src.indexOf("@3xl:grid-cols-[340px_minmax(0,1fr)]");
    expect(search).toBeGreaterThan(0);
    expect(search).toBeLessThan(grid);
    // lead-service's label wins where a stored fact matches; the display lookup is the fallback.
    expect(src).toContain("<TagChip tag={tag ?? timelineTag(item)} />");
  });
});
