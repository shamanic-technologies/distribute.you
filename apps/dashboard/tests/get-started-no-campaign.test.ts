import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { signupCampaignFunnelFrom } from "../src/lib/v2/signup-campaign";

/**
 * GS-STEP11-NO-CAMPAIGN-1122 (owner 2026-11-22, « BUG!!! »): saasdocs.online reached the campaign step and read
 * « No campaign can run right now. » while the top banner said « Your campaign is ready to launch ». The per-offer
 * funnel read answered no row: the offer's stated steps had no Meeting booked, so features-service set every
 * meetings-booked funnel aside (producer fix spawned in features-service).
 */
const SET_ASIDE_BODY = {
  rows: [],
  total: 0,
  setAside: { total: 456, truncated: true, rows: [] },
  setAsideByStep: [
    { id: "meeting_attended", name: "Meeting attended", setAsideCount: 456 },
    { id: "meeting_booked", name: "Meeting booked", setAsideCount: 456 },
  ],
};

const RUNNABLE_BODY = {
  rows: [
    {
      id: "start_to_lead_found@lead-sourcing+lead_found_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked@ai-meeting-booking+meeting_booked_to_meeting_attended+meeting_attended_to_paid_client",
      name: "Cold email to meetings",
      type: "proactive",
      costUsd: null,
      costPer: null,
      roi: null,
      status: "learning",
      runnable: true,
      mixed: true,
    },
  ],
};

describe("campaign step with no runnable funnel (saasdocs.online)", () => {
  it("answers no campaign and says why, loud", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(signupCampaignFunnelFrom(SET_ASIDE_BODY)).toBeNull();
    expect(err).toHaveBeenCalledWith(
      "[signup-campaign] no runnable meetings-booked funnel for this offer",
      expect.objectContaining({ rows: 0, setAsideByStep: SET_ASIDE_BODY.setAsideByStep }),
    );
    err.mockRestore();
  });

  it("launches the meetings-booked funnel once the producer serves it (mixed is a fact, never a refusal)", () => {
    expect(signupCampaignFunnelFrom(RUNNABLE_BODY)?.salesFunnelId).toBe(RUNNABLE_BODY.rows[0].id);
  });

  it("the top banner never says the campaign is ready while the step has none", () => {
    const src = readFileSync(resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(src).toContain("const campaignBannerShown = readyForCampaign && !!funnel;");
    const banner = src.indexOf('<div className="gs-down sticky');
    expect(banner).toBeGreaterThan(0);
    expect(src.slice(banner - 40, banner)).toContain("{campaignBannerShown && (");
    // The step itself stays, with its plain sentence and Try again: never hidden, never a reassurance.
    expect(src).toContain('"No campaign can run right now."');
  });

  it("asks the funnels for the campaign's Target, so an offer with no meeting step still gets one", () => {
    const api = readFileSync(resolve(__dirname, "../src/lib/api.ts"), "utf8");
    const at = api.indexOf("export async function getSignupFunnelPage(");
    const fn = api.slice(at, api.indexOf("export async function listOfferSalesFunnels(", at));
    expect(fn).toContain("&target=${encodeURIComponent(target)}");
    const src = readFileSync(resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(src).toContain("await getSignupFunnelPage(id, offerId, SIGNUP_TARGET,");
  });
});
