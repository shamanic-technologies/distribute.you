import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANGLE_STRATEGY_IDS, angleStrategy, coldEmailStrategyOf, funnelFitsAngles, toggleAngle, type EmailAngle } from "../src/lib/v2/email-angles";
import { firstOfType, type PublicSalesFunnelRow } from "../src/lib/v2/signup-campaign";

const set = (...a: EmailAngle[]) => new Set<EmailAngle>(a);
const funnel = (cold: string) => `start_to_lead_found@lead-sourcing+lead_found_to_conversation@sales-cold-email-outreach${cold}+conversation_to_paid_client`;
const row = (id: string, roi: number): PublicSalesFunnelRow => ({ id, name: id, type: "proactive", costUsd: 1, costPer: "per x", roi, status: "measured", runnable: true, mixed: false });

describe("email style picks (owner 2026-10-17)", () => {
  it("maps a pick to the cold email strategy: one = only, two = without the third, three = default", () => {
    expect(angleStrategy(set("offer"))).toBe("offer-emails-only");
    expect(angleStrategy(set("named"))).toBe("named-emails-only");
    expect(angleStrategy(set("blind"))).toBe("blind-emails-only");
    expect(angleStrategy(set("offer", "named"))).toBe("no-blind-emails");
    expect(angleStrategy(set("offer", "blind"))).toBe("no-named-emails");
    expect(angleStrategy(set("named", "blind"))).toBe("no-offer-emails");
    expect(angleStrategy(set("offer", "named", "blind"))).toBeNull();
  });

  it("never lets the last style be unticked", () => {
    expect([...toggleAngle(set("offer"), "offer")]).toEqual(["offer"]);
    expect([...toggleAngle(set("offer", "named"), "offer")]).toEqual(["named"]);
    expect(toggleAngle(set("offer"), "blind").has("blind")).toBe(true);
  });

  it("reads the cold email play off a funnel id", () => {
    expect(coldEmailStrategyOf(funnel("~offer-emails-only"))).toBe("offer-emails-only");
    expect(coldEmailStrategyOf(funnel(""))).toBeNull();
    expect(coldEmailStrategyOf("start_to_lead_found@lead-sourcing~valid-catch-all+lead_found_to_conversation@sales-cold-email-outreach+x")).toBeNull();
  });

  it("picks the asked play, and never an angle play nobody asked for", () => {
    const rows = [row(funnel("~no-offer-emails"), 3), row(funnel("~valid-catch-all"), 2), row(funnel(""), 1), row(funnel("~blind-emails-only"), 1)];
    // No pick: the angle play ranked first is skipped, a non-angle play still competes on ROI.
    expect(firstOfType(rows, "proactive", (id) => funnelFitsAngles(id, null))?.salesFunnelId).toBe(funnel("~valid-catch-all"));
    expect(firstOfType(rows, "proactive", (id) => funnelFitsAngles(id, "blind-emails-only"))?.salesFunnelId).toBe(funnel("~blind-emails-only"));
    expect(firstOfType(rows, "proactive", (id) => funnelFitsAngles(id, "offer-emails-only"))).toBeNull();
    expect(ANGLE_STRATEGY_IDS.size).toBe(6);
  });

  it("the walk reads the funnels for the picked style, and asks each example in that style", () => {
    const flow = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(flow).toContain("getSignupFunnelPages(id, offerId, strategy ? `${ANGLE_CHANNEL}~${strategy}` : null)");
    expect(flow).toContain("(funnelId) => funnelFitsAngles(funnelId, strategy)");
    expect(flow).toContain("}, [brandId, offer?.offerId, answered, canReadFunnels, styleStrategy]);");
    const ex = flow.slice(flow.indexOf("async function writeExample("), flow.indexOf("// ── The stage"));
    expect(ex).toContain("strategyId: EMAIL_ANGLES.find((a) => a.key === angle)!.only,");
  });
});
