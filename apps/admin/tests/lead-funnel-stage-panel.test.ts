import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FUNNEL_CHAINS,
  isWritableStage,
  leadFunnelStages,
  saleValueCentsFrom,
  trackedStages,
} from "../src/lib/lead-funnel-stages";
import { MANUAL_QUALIFICATION_STATUSES, statusLabel } from "../src/lib/manual-qualification";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const PAGE = read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/leads/page.tsx");
const SECTION = read("src/components/leads/lead-funnel-stage-section.tsx");

describe("admin funnel stages", () => {
  it("walks each funnel's own chain", () => {
    expect(leadFunnelStages("reply_meeting").map((s) => s.key)).toEqual([
      "positive_reply",
      "meeting_booked",
      "meeting_attended",
      "sale",
    ]);
    expect(leadFunnelStages("visit_form").map((s) => s.key)).toEqual([
      "website_visit",
      "form_submission",
      "sale",
    ]);
  });

  it("states nothing for a campaign that names no funnel", () => {
    // A campaign with no funnel has no chain. Showing steps it never sold would be
    // worse than showing none.
    expect(leadFunnelStages(null)).toEqual([]);
  });

  it("resolves the chain from each lead's OWN campaign, not one funnel for the page", () => {
    // This page lists a whole feature's leads across many campaigns.
    expect(PAGE).toContain("funnelByCampaignId.get(selectedLead.campaignId)");
    expect(PAGE).toContain("if (c.funnelKey) m.set(c.id, c.funnelKey");
  });

  it("offers no control on a stage lead-service cannot record", () => {
    expect(isWritableStage("positive_reply")).toBe(false);
    expect(isWritableStage("website_visit")).toBe(false);
    expect(isWritableStage("meeting_attended")).toBe(true);
  });

  it("carries NO reply control, because this console states the reply in its own modal", () => {
    // Two affordances for one fact is what this whole change removed.
    expect(SECTION).not.toContain("ReplyKindControl");
    expect(SECTION).not.toContain("reply?:");
  });

  it("never substitutes a zero for an unpriced deal", () => {
    expect(saleValueCentsFrom("$4,900")).toBe(490000);
    for (const bad of ["", "abc", "0", "-5"]) expect(saleValueCentsFrom(bad)).toBeNull();
  });

  it("treats absent evidence as unseen, never as did-not-happen", () => {
    expect(trackedStages({ signup: false })).toEqual({});
    expect(trackedStages(null)).toEqual({});
  });

  it("renders a producer refusal through its own helper, never the Error's message", () => {
    expect(PAGE).toContain("leadStepErrorMessage(err)");
  });
});

describe("the reply vocabulary no longer offers deal progress", () => {
  it("drops the two retired deal-progress values from what a person may state", () => {
    // They are facts about the DEAL, stated on the funnel stages now. Offering them
    // here too would record one fact in two stores — which is what let a booked meeting
    // erase the reply sentiment that led to it.
    expect(MANUAL_QUALIFICATION_STATUSES).not.toContain("lead_meeting_booked");
    expect(MANUAL_QUALIFICATION_STATUSES).not.toContain("lead_closed");
  });

  it("still RENDERS them, because historical rows carry them", () => {
    // Dropping the label would leave an old row showing a blank.
    expect(statusLabel("lead_meeting_booked")).toBeTruthy();
    expect(statusLabel("lead_closed")).toBeTruthy();
  });

  it("offers the four positive distinctions", () => {
    for (const k of ["lead_interested", "lead_info_requested", "lead_meeting_requested", "lead_referral"] as const) {
      expect(MANUAL_QUALIFICATION_STATUSES).toContain(k);
      expect(statusLabel(k)).toBeTruthy();
    }
  });

  it("keeps admin's chains equal to the funnel catalogue's names", () => {
    expect(Object.keys(FUNNEL_CHAINS).sort()).toEqual(
      ["reply_meeting", "visit_form", "visit_meeting", "visit_signup"],
    );
  });
});
