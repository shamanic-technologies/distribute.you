import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { timeUntil } from "../src/lib/friendly-datetime";
import { canFollowUpNow, followupLine, followupNotice, leadFollowup } from "../src/lib/lead-followup";
import type { LeadHistory } from "../src/lib/lead-history";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function history(events: Array<Record<string, unknown>>): LeadHistory {
  return {
    leadCampaignId: "row-1",
    leadId: "lead-1",
    campaignId: "camp-1",
    brandId: "brand-1",
    email: "someone@example.com",
    scope: "campaign",
    campaignIds: ["camp-1"],
    campaignsTruncated: false,
    events,
  } as unknown as LeadHistory;
}

describe("leadFollowup", () => {
  it("reads a scheduled follow-up off the producer's own event", () => {
    const f = leadFollowup(
      history([
        { id: "a", type: "delivery", at: "2026-09-01T10:00:00.000Z" },
        {
          id: "b",
          type: "followup",
          state: "scheduled",
          dueAt: "2026-09-08T09:00:00.000Z",
          followupCount: 2,
        },
      ]),
    );
    expect(f).toEqual({
      state: "scheduled",
      dueAt: "2026-09-08T09:00:00.000Z",
      followupCount: 2,
      answerer: null,
    });
  });

  it("is not_set when the producer reports no follow-up event at all", () => {
    expect(leadFollowup(history([{ id: "a", type: "message" }]))).toEqual({ state: "not_set" });
  });

  it("is not_set for an empty or absent history rather than throwing", () => {
    expect(leadFollowup(history([]))).toEqual({ state: "not_set" });
    expect(leadFollowup(null)).toEqual({ state: "not_set" });
    expect(leadFollowup(undefined)).toEqual({ state: "not_set" });
  });

  it("reports a stopped schedule with the producer's reason", () => {
    expect(
      leadFollowup(
        history([{ id: "a", type: "followup", state: "stopped", stoppedReason: "meeting booked" }]),
      ),
    ).toEqual({ state: "stopped", reason: "meeting booked" });
  });

  it("keeps a stopped schedule stopped even if a scheduled event is also present", () => {
    // The producer nulls the due date when it stops a sequence, so both should never be
    // live at once. If they ever are, the honest answer is the one that says nothing
    // further will be sent — never a date we would then offer to bring forward.
    const f = leadFollowup(
      history([
        { id: "a", type: "followup", state: "scheduled", dueAt: "2026-09-08T09:00:00.000Z" },
        { id: "b", type: "followup", state: "stopped", stoppedReason: "they unsubscribed" },
      ]),
    );
    expect(f).toEqual({ state: "stopped", reason: "they unsubscribed" });
  });

  it("ignores a scheduled event carrying no due date", () => {
    expect(
      leadFollowup(history([{ id: "a", type: "followup", state: "scheduled", dueAt: null }])),
    ).toEqual({ state: "not_set" });
  });

  it("defaults an absent follow-up count to zero rather than dropping the schedule", () => {
    expect(
      leadFollowup(
        history([{ id: "a", type: "followup", state: "scheduled", dueAt: "2026-09-06T09:00:00Z" }]),
      ),
    ).toEqual({ state: "scheduled", dueAt: "2026-09-06T09:00:00Z", followupCount: 0, answerer: null });
  });
});

describe("followupLine", () => {
  it("states how long until a future follow-up", () => {
    expect(
      followupLine(
        { state: "scheduled", dueAt: "2026-09-08T12:00:00.000Z", followupCount: 1, answerer: null },
        NOW,
      ),
    ).toBe("Next follow-up in 3 days");
  });

  it("reads due now for a date already passed, never a negative count", () => {
    expect(
      followupLine(
        { state: "scheduled", dueAt: "2026-09-01T12:00:00.000Z", followupCount: 4, answerer: null },
        NOW,
      ),
    ).toBe("Next follow-up due now");
  });

  it("says a schedule is not set when nothing is owed", () => {
    expect(followupLine({ state: "not_set" }, NOW)).toBe("Next follow-up: not set");
  });

  it("says no further follow-ups when the schedule was stopped", () => {
    expect(followupLine({ state: "stopped", reason: "they replied" }, NOW)).toBe(
      "No further follow-ups",
    );
  });
});

describe("canFollowUpNow", () => {
  it("offers the control while a schedule exists or is simply unset", () => {
    expect(canFollowUpNow({ state: "scheduled", dueAt: "2026-09-08T12:00:00Z", followupCount: 0, answerer: null })).toBe(true);
    expect(canFollowUpNow({ state: "not_set" })).toBe(true);
  });

  it("never offers it on a stopped schedule", () => {
    // A sequence stops because the prospect booked, opted out, or answered — writing to
    // them anyway is the exact thing that state exists to prevent.
    expect(canFollowUpNow({ state: "stopped", reason: "they unsubscribed" })).toBe(false);
  });
});

describe("timeUntil", () => {
  it("counts minutes, hours and calendar days forward", () => {
    expect(timeUntil("2026-09-05T12:30:00.000Z", NOW)).toBe("in 30 minutes");
    expect(timeUntil("2026-09-05T12:01:00.000Z", NOW)).toBe("in 1 minute");
    expect(timeUntil("2026-09-08T12:00:00.000Z", NOW)).toBe("in 3 days");
  });

  it("reads a past instant as now rather than a negative count", () => {
    expect(timeUntil("2026-09-04T12:00:00.000Z", NOW)).toBe("now");
    expect(timeUntil("2026-09-05T11:59:59.000Z", NOW)).toBe("now");
  });

  it("falls back to a plain date past a month out", () => {
    expect(timeUntil("2026-12-01T12:00:00.000Z", NOW)).toMatch(/^on /);
  });
});

describe("the surface that renders it", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
  const section = read("components/leads/lead-next-followup.tsx");
  const timeline = read("components/audiences/lead-history-timeline.tsx");
  const page = read("components/audiences/engaged-leads-page.tsx");

  it("derives nothing about the schedule in the component", () => {
    // Ordering, precedence and what a stopped sequence means are lead-service's. The
    // component reads the model and renders it.
    expect(section).toContain("leadFollowup(history)");
    expect(section).not.toContain(".events.filter");
    expect(section).not.toContain(".sort(");
  });

  it("keys the write on the row this timeline is about", () => {
    expect(timeline).toContain("leadRowId={history.leadCampaignId}");
  });

  it("mounts the section on the CAMPAIGN-scoped timelines and nowhere else", () => {
    // The pin is the CALL SITE, not the component: a component perfectly able to render
    // the line is the feature entirely absent if no page asks for it — and mounting it on
    // the brand roll-up would put several schedules behind one sentence.
    const mounts = page.match(/showNextFollowup/g) ?? [];
    expect(mounts.length).toBe(2);
    const brandRollup = page.slice(page.indexOf('heading="Everything this brand did"'));
    expect(brandRollup).not.toContain("showNextFollowup");
  });

  it("holds the pressed statement locally so the control is not silent for a round trip", () => {
    expect(section).toContain("setAsked(true)");
    expect(section).toContain("onError: () => setAsked(false)");
  });

  it("offers the follow-up-now button to the beta cohort only, with its badge", () => {
    expect(section).toContain("const isBeta = useIsBetaUser();");
    expect(section).toContain("{isBeta && canFollowUpNow(followup) && (");
    expect(section).toContain('<MaturityBadge level="beta" />');
  });

  it("renders a refusal rather than swallowing it", () => {
    expect(section).toContain("isError");
    expect(section).toContain("error?.message");
  });
});

// Shapes copied from lead-service's history contract (v0.82.0, `answerer` on a scheduled
// follow-up). The five prospects this exists for sat under "due now" with nobody able to
// claim them.
function scheduledWith(answerer: Record<string, unknown> | undefined) {
  return leadFollowup(
    history([
      {
        id: "f",
        type: "followup",
        state: "scheduled",
        dueAt: "2026-09-01T12:00:00.000Z",
        followupCount: 0,
        ...(answerer ? { answerer } : {}),
      },
    ]),
  );
}

const ANSWERED = {
  state: "answered",
  answeredBy: {
    campaignId: "c-2",
    legKey: "conversation->meeting_booked",
    status: "ongoing",
    featureSlug: "ai-meeting-booking",
    acquisitionChannel: "ai-meeting-booking",
    workflowSlug: "w",
  },
  absence: null,
  startableFeatureSlugs: [],
  candidate: null,
  candidateAnswersCampaignId: null,
  reason: null,
};
const unanswered = (absence: string, startable: string[] = []) => ({
  state: "unanswered",
  answeredBy: null,
  absence,
  startableFeatureSlugs: startable,
  candidate: null,
  candidateAnswersCampaignId: null,
  reason: null,
});

describe("followupNotice (who will answer)", () => {
  it("keeps the due date when a campaign will answer", () => {
    const f = scheduledWith(ANSWERED);
    expect(f.state === "scheduled" && f.answerer?.answeredByFeatureSlug).toBe("ai-meeting-booking");
    const n = followupNotice(f, NOW);
    expect(n.line).toBe("Next follow-up due now");
    expect(n.tone).toBe("neutral");
    expect(n.fix).toBeNull();
    expect(canFollowUpNow(f)).toBe(true);
  });

  it("reads an older payload with no answerer exactly as before", () => {
    const f = scheduledWith(undefined);
    expect(followupNotice(f, NOW).line).toBe("Next follow-up due now");
    expect(canFollowUpNow(f)).toBe(true);
  });

  it("says nobody will answer, never due now, and points at starting the channel", () => {
    const f = scheduledWith(unanswered("no_answering_campaign", ["ai-meeting-booking"]));
    const n = followupNotice(f, NOW);
    expect(n.line).toBe("Nobody will answer this person");
    expect(n.line).not.toContain("due now");
    expect(n.detail).toBe("No campaign on this offer answers interested replies yet.");
    expect(n.fix).toEqual({ kind: "start", featureSlug: "ai-meeting-booking" });
    expect(canFollowUpNow(f)).toBe(false);
  });

  it("offers a restart when the answering campaign is paused", () => {
    const n = followupNotice(scheduledWith(unanswered("answering_campaign_stopped", ["ai-meeting-booking"])), NOW);
    expect(n.fix).toEqual({ kind: "restart" });
    expect(n.detail).toContain("paused");
  });

  it("offers no start link for an absence starting a channel cannot fix", () => {
    for (const absence of [
      "answering_campaign_serves_another",
      "no_leg_continues",
      "campaign_states_no_leg",
      "campaign_states_no_offer",
      "campaign_states_no_brand",
    ]) {
      const n = followupNotice(scheduledWith(unanswered(absence)), NOW);
      expect(n.line).toBe("Nobody will answer this person");
      expect(n.detail).toBeTruthy();
      expect(n.detail).not.toContain(absence);
      expect(n.fix).toBeNull();
    }
  });

  it("never prints a raw code for an absence it does not know yet", () => {
    const n = followupNotice(scheduledWith(unanswered("some_future_reason")), NOW);
    expect(n.line).toBe("Nobody will answer this person");
    expect(n.detail).toBeNull();
  });

  it("says we could not check when the answer is unknown, never due now and never nobody", () => {
    const f = scheduledWith({ ...unanswered(""), state: "unknown", absence: null, reason: "campaign-service answered 502" });
    const n = followupNotice(f, NOW);
    expect(n.line).toBe("We could not check who will answer this person");
    expect(n.line).not.toContain("due now");
    expect(n.line).not.toContain("Nobody");
    expect(n.detail).not.toContain("502");
    expect(canFollowUpNow(f)).toBe(false);
  });

  it("leaves a stopped follow-up rendering exactly as it did", () => {
    const n = followupNotice({ state: "stopped", reason: "they booked" }, NOW);
    expect(n).toEqual({ line: "No further follow-ups", detail: null, tone: "neutral", fix: null });
  });

  it("carries no em-dash in any customer-facing line", () => {
    const src = readFileSync(join(__dirname, "..", "src", "lib", "lead-followup.ts"), "utf8");
    const strings = src.match(/"[^"\n]*"/g) ?? [];
    for (const str of strings) expect(str).not.toContain("\u2014");
  });

  it("links the fix to the CAMPAIGN's own offer settings, and writes nothing", () => {
    const section = readFileSync(join(__dirname, "..", "src", "components", "leads", "lead-next-followup.tsx"), "utf8");
    expect(section).toContain("followupNotice(followup)");
    expect(section).toContain("data?.campaign.offerId");
    expect(section).toContain("/settings`}");
    const fixLink = section.slice(section.indexOf("function FollowupFixLink("));
    expect(fixLink).not.toContain("useMutation");
    expect(fixLink).not.toContain("setCampaignStatus");
  });
});
