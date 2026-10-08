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
  it("keeps a step it does not know, in its producer word, neutral", () => {
    expect(timelineTag(ev("brand_new_step"))).toEqual({ label: "Brand new step", tone: "neutral", icon: "dot" });
    expect(timelineTag(ev(null)).label).toBe("Event");
  });
});

describe("Unibox search runs the whole width, above both cards (owner 2026-10-08)", () => {
  it("renders the search before the cards grid, not inside the People card", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/components/v2/integrations-conversations.tsx", import.meta.url), "utf8");
    const search = src.indexOf('placeholder="Search people and messages"');
    const grid = src.indexOf("lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows");
    expect(search).toBeGreaterThan(0);
    expect(search).toBeLessThan(grid);
    expect(src).toContain("<TagChip tag={timelineTag(item)} />");
  });
});
