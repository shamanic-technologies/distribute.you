import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const PAGE = read("src/components/audiences/engaged-leads-page.tsx");
const SECTION = read("src/components/leads/lead-funnel-stage-section.tsx");
const HOOK = read("src/lib/use-lead-step-statements.ts");

describe("lead funnel stage panel", () => {
  it("keys the control set on the campaign's FUNNEL, never on a goal", () => {
    // `sales_meetings` covers both meeting funnels, so a goal cannot say whether the
    // chain starts at a reply or at a website visit — the exact distinction this panel
    // records. The campaign has stated its funnelKey since #3344.
    const slice = PAGE.slice(PAGE.indexOf("const panelFunnel ="), PAGE.indexOf("const onSetStage ="));
    expect(slice).toContain("activeFunnelKeys[0]");
    expect(slice).toContain("leadFunnelStages(panelFunnel.key)");
    expect(slice).not.toContain("optimizationGoal");
    expect(slice).not.toContain("stepsFor(");
  });

  it("mounts ONLY under a campaign, where exactly one funnel is sold", () => {
    expect(PAGE).toContain("{campaignId && panelFunnel && (");
  });

  it("states the lead by its ROW id, which is what carries the campaign", () => {
    // `lead.leadId` is the person and is brand-grained; the leads_campaigns row is what
    // makes a statement attributable to the campaign it was made on.
    const slice = PAGE.slice(PAGE.indexOf("useLeadStepStatements("), PAGE.indexOf("const setStage ="));
    expect(slice).toContain("selectedLead.id");
    expect(slice).not.toContain("selectedLead.leadId");
  });

  it("renders a producer refusal through its own helper, never err.message", () => {
    // apiCall sets `message` to the whole downstream body verbatim — rendering it puts
    // a JSON blob in front of a customer and destroys the code consumers branch on.
    expect(PAGE).toContain("leadStepErrorMessage(err)");
    const slice = PAGE.slice(PAGE.indexOf("const onSetStage ="), PAGE.indexOf("const onSetStage =") + 1400);
    expect(slice).not.toContain("err.message");
  });

  it("offers NO control on a stage lead-service cannot record", () => {
    // A reply belongs to the message and a visit to the delivery layer. A button that
    // cannot write is worse than no button.
    expect(SECTION).toContain("isWritableStage(stage.key)");
    expect(SECTION).toContain("writable ? (");
  });

  it("never offers a retraction, because the producer has no write back to pending", () => {
    // The old shape let a click on the active button clear it. There is no such route;
    // a statement is corrected by making the other one.
    expect(SECTION).not.toContain('=== "outcome" ? "pending"');
    expect(SECTION).not.toContain('=== "never" ? "pending"');
    expect(SECTION).toContain('disabled={locked || state === "outcome"}');
  });

  it("re-reads after a write instead of reconstructing the producer's answer", () => {
    // lead-service decides more than the field written: an outcome can supersede an
    // earlier `never`, and it stamps source, user and time.
    expect(HOOK).toContain("invalidateQueries");
    expect(HOOK).not.toContain("setQueryData");
  });

  it("invalidates the revenue ROOT, because a statement moves the money at every grain", () => {
    expect(HOOK).toContain('queryKey: ["featureRevenue"]');
  });

  it("does not poll the statements", () => {
    // Nothing else writes them: a statement arrives because somebody in this session
    // made it, and the tracker's own arrivals ride the /revenue join the page polls.
    expect(HOOK).not.toContain("refetchInterval");
  });

  it("carries no em-dash in any user-facing string", () => {
    const strings = SECTION.match(/"[^"\n]{12,}"/g) ?? [];
    for (const s of strings) expect(s).not.toContain("—");
  });
});

describe("the reply row", () => {
  const CONTROL = read("src/components/leads/reply-kind-control.tsx");

  it("gives the reply row a control, not a dead reading", () => {
    // On a reply-led funnel the reply is the FIRST step. Leaving it the only
    // unactionable row above three actionable ones reads as broken, not as a boundary.
    expect(SECTION).toContain('stage.key === "positive_reply" && reply');
    expect(SECTION).toContain("<ReplyKindControl");
  });

  it("is a PICKER, because a reply is not a yes/no", () => {
    // Nine kinds in four groups. The positive case splits four ways precisely because
    // "positive" cannot separate "not the buyer" from "wants to book".
    expect(CONTROL).toContain("REPLY_TONE_ORDER.map");
    expect(CONTROL).toContain("replyKindsByTone(tone)");
    expect(CONTROL).not.toContain("StageButton");
  });

  it("distinguishes never-seen, seen-but-unstated, and stated-but-unknown", () => {
    // Three different statements. Collapsing them invites someone to overwrite a real
    // statement they simply cannot see.
    expect(CONTROL).toContain("Not seen");
    expect(CONTROL).toContain("Replied, kind not stated");
    expect(CONTROL).toContain("Stated, not shown here yet");
  });

  it("renders the resolved kind, never the raw thing a person clicked", () => {
    // `status` is provenance and still carries two retired deal-progress spellings;
    // `replyKind` is what those resolve to upstream at write time.
    const slice = PAGE.slice(PAGE.indexOf("const replyKind ="), PAGE.indexOf("const replyKind =") + 200);
    expect(slice).toContain(".replyKind");
    expect(slice).not.toContain(".status");
  });

  it("reads only THIS lead's row, not the org-wide list", () => {
    const slice = PAGE.slice(PAGE.indexOf('["leadReplyKind"'), PAGE.indexOf("const replyKind ="));
    expect(slice).toContain("email: replyEmail");
    expect(slice).toContain("limit: 1");
  });

  it("writes no retired deal-progress value", () => {
    // Those are facts about the deal and are stated on the funnel stages instead.
    expect(CONTROL).not.toContain("lead_meeting_booked");
    expect(CONTROL).not.toContain("lead_closed");
  });

  it("re-stating the current kind is a no-op", () => {
    // Otherwise the record of who said what grows a second identical row.
    expect(CONTROL).toContain("if (o.kind !== kind) onSet(o.kind)");
  });
});
