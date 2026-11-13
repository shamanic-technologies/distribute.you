import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CampaignNextStepsSchema, heldStepCopy, heldStepOf, waitingOnLimit } from "../src/lib/held-step";

const HELD = {
  outcome: "message_written",
  pipeCampaignId: "pipe-1",
  reason: "campaign_states_no_brief",
  heldSince: "2026-11-10T09:00:00.000Z",
  lastAnsweredAt: "2026-11-11T09:00:00.000Z",
};

describe("held step (NEXT-STEPS-TRUE-REASON-1111)", () => {
  it("parses the served body and an older body without the new fields", () => {
    const full = CampaignNextStepsSchema.parse({
      salesFunnelCampaignId: "c1",
      nextSends: { leadsQueued: 123, heldBy: HELD, leadsWaitingOnHeldEngine: 123 },
      heldEngines: [HELD],
    });
    expect(heldStepOf(full)).toEqual({ held: HELD, waiting: 123 });
    const older = CampaignNextStepsSchema.parse({ salesFunnelCampaignId: "c1", nextSends: { leadsQueued: 0 } });
    expect(heldStepOf(older)).toBeNull();
    const nulls = CampaignNextStepsSchema.parse({ salesFunnelCampaignId: "c1", nextSends: { heldBy: null, leadsWaitingOnHeldEngine: null }, heldEngines: null });
    expect(heldStepOf(nulls)).toBeNull();
  });

  it("states the step, who waits, since when, and the brief fix", () => {
    const copy = heldStepCopy(HELD, 123, "Message written");
    expect(copy.headline).toBe("Message written needs your brief");
    expect(copy.body).toBe("123 people have been waiting at this step since Nov 10. Write a brief to start this step.");
    expect(copy.fix).toBe("brief");
    expect(copy.actionLabel).toBe("Write a brief");
  });

  it("a reason that is ours carries no action, and never the code", () => {
    const copy = heldStepCopy({ ...HELD, reason: "no_runnable_script_kept" }, 1, "Message written");
    expect(copy.headline).toBe("Message written is on hold");
    expect(copy.body).toContain("1 person has been waiting");
    expect(copy.fix).toBeNull();
    expect(copy.actionLabel).toBeNull();
    for (const text of [copy.headline, copy.body]) {
      expect(text).not.toMatch(/_/);
      expect(text).not.toMatch(/[—–]/);
    }
  });

  it("a limit hold is the limit note's: no second card saying our team is on it (prod 2026-11-13, CeXO)", () => {
    for (const reason of ["daily_ceiling_reached", "unfunded", "insufficient_credits"]) {
      const steps = CampaignNextStepsSchema.parse({
        salesFunnelCampaignId: "c1",
        nextSends: { heldBy: { ...HELD, outcome: "lead_found", reason }, leadsWaitingOnHeldEngine: 69 },
      });
      expect(heldStepOf(steps)).toBeNull();
      expect(waitingOnLimit(steps)).toBe(69);
    }
    const ours = CampaignNextStepsSchema.parse({ salesFunnelCampaignId: "c1", nextSends: { heldBy: HELD, leadsWaitingOnHeldEngine: 5 } });
    expect(waitingOnLimit(ours)).toBeNull();
  });

  it("the limit note on the funnel page carries the people waiting", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/funnel-campaigns.tsx"), "utf8");
    expect(src).toContain("waitingOnLimit(useFunnelCampaignNextSteps(campaign.brandId, campaign.id).data)");
    expect(src).toContain('waiting={g.hold.reason === "daily_ceiling_reached" ? waitingOnHold : null}');
  });

  it("no count served reads only the day", () => {
    expect(heldStepCopy(HELD, null, "Message written").body.startsWith("On hold since Nov 10.")).toBe(true);
  });

  it("the funnel campaign page mounts the note", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/funnel-campaigns.tsx"), "utf8");
    expect(src).toContain("<HeldStepNote brandId={campaign.brandId} salesFunnelCampaignId={campaign.id} />");
  });
});
