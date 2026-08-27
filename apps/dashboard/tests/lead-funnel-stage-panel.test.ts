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

describe("the panel answers the click at once", () => {
  it("shows the kind the person just picked, before the producer has answered", () => {
    // A picker that keeps reading "Replied, kind not stated" for the whole write reads
    // as a control that did nothing. The CALL SITE is what puts it on screen — a page
    // that computes the value and passes the served one is the feature entirely absent
    // with the component perfectly correct.
    const call = PAGE.slice(PAGE.indexOf("<LeadFunnelStageSection"), PAGE.indexOf("<LeadFunnelStageSection") + 900);
    expect(call).toContain("kind: shownReplyKind");
    expect(PAGE).toContain("statedReply.email === replyEmail");
  });

  it("shows the stage statement just pressed, scoped to the lead it was made on", () => {
    // Same gap, one row up: the stage rows read off a query that only answers after the
    // write plus a re-read. Scoped by lead row, so opening another lead cannot inherit
    // somebody else's pending statement.
    const slice = PAGE.slice(PAGE.indexOf("const panelStates = useMemo("), PAGE.indexOf("const panelValues ="));
    expect(slice).toContain("statedStage.leadRowId !== selectedLead?.id");
    expect(slice).toContain("[statedStage.key]: statedStage.next");
  });

  it("still re-reads the chain from the producer, never deriving it here", () => {
    // lead-service decides more than the field written — an outcome supersedes an
    // earlier never, and the cascade is its answer. The pending statement covers one
    // row while that read lands; it does not replace it.
    expect(HOOK).toContain("invalidateQueries");
    expect(PAGE).not.toContain("chainIndex <");
  });

  it("writes the producer's own answer into the cache instead of re-reading it", () => {
    // The response IS the row this query reads (`limit: 1`, newest first). Invalidating
    // costs a second round trip to learn what the producer has already said, and it is
    // that wait the pill sat through.
    const slice = PAGE.slice(PAGE.indexOf("const setReply = useMutation("), PAGE.indexOf("const onSetReply ="));
    expect(slice).toContain("setQueryData");
    expect(slice).toContain("qualifications: [res.qualification]");
    expect(slice).not.toContain('invalidateQueries({ queryKey: ["leadReplyKind"');
  });

  it("drops a pending statement the producer refused", () => {
    // The panel error says why; leaving it up would state something nobody recorded.
    const reply = PAGE.slice(PAGE.indexOf("const onSetReply ="), PAGE.indexOf("const onSetStage ="));
    expect(reply).toContain("setStatedReply(null)");
    const stage = PAGE.slice(PAGE.indexOf("const onSetStage ="), PAGE.indexOf("const onSetStage =") + 1400);
    expect(stage).toContain("setStatedStage(null)");
  });

  it("leads the panel with what happened, above who the person works for", () => {
    // The funnel is what the reader came to state; the organisation is context they can
    // scroll to.
    expect(PAGE.indexOf("<LeadFunnelStageSection")).toBeLessThan(PAGE.indexOf(">Organization<"));
  });

  it("states the delivery badge once, on the funnel row that owns it", () => {
    // The identity card carried the same badge under "Status", so one lead read its own
    // delivery twice on one screen. The two GLOBAL flags stay: they are about every
    // brand in the org, which nothing below repeats.
    expect(PAGE).not.toContain('<span className="text-gray-500">Status:</span>');
    expect(PAGE).toContain("Across every brand:");
    expect(PAGE).toContain("Global Unsubscribed");
  });

  it("carries no info tooltip on the card heading nor on the delivery row", () => {
    // Both explained what the card already reads as. The tips that stay are the ones
    // that state something the row cannot: what an amount is for, and that an outcome
    // was also measured automatically.
    expect(SECTION).not.toContain("DELIVERY_TIP");
    expect(SECTION).not.toContain("counts exactly like something we tracked");
    expect(SECTION).toContain("VALUE_TIP");
    expect(SECTION).toContain("TRACKED_TIP");
  });
});

describe("stating what a won deal was worth", () => {
  it("asks for the amount instead of sending a sale the producer will refuse", () => {
    // lead-service 400s a sale with no value. Predicting a refusal and asking the
    // question is the honest surface; submitting anyway is not.
    expect(SECTION).toContain("stageRequiresValue(stage.key)");
    expect(SECTION).toContain("setAskingValueFor(stage.key as WritableStageKey)");
  });

  it("cannot submit the amount form until what was typed IS an amount", () => {
    expect(SECTION).toContain("saleValueCentsFrom(raw)");
    expect(SECTION).toContain("disabled={valueCents == null || busy}");
  });

  it("reads the recorded amount back where it was typed", () => {
    expect(SECTION).toContain('data-testid="lead-funnel-stage-value"');
    expect(PAGE).toContain("stageValuesFrom(stepStatements)");
    expect(PAGE).toContain("values={panelValues}");
  });

  it("sends the amount only when the control asked for one", () => {
    // A `never` carries no value and the producer refuses one, so the key is omitted
    // rather than sent empty.
    expect(PAGE).toContain("valueCents === undefined ? { step: key, kind: next }");
  });

  it("leaves every other stage a single click, with no amount in the request", () => {
    expect(SECTION).toContain(': onSet(stage.key as WritableStageKey, "outcome")');
    expect(SECTION).toContain('onClick={() => onSet(stage.key as WritableStageKey, "never")}');
  });
});

describe("the chain constrains its neighbours", () => {
  const HOOK2 = read("src/lib/use-lead-step-statements.ts");

  it("renders a step the CHAIN concluded as an answer, with no control", () => {
    // A funnel is a chain: a never ends every later step, an outcome reaches every
    // earlier one. Nobody stated those, so offering a button would invite somebody to
    // state a thing already concluded, which would move on its own the moment the
    // statement behind it changed.
    expect(SECTION).toContain("const isImplied = implied?.[stage.key] === true;");
    expect(SECTION).toContain("{isImplied ? (");
  });

  it("says what ending a step also ends, BEFORE it is clicked", () => {
    // One click mid-chain ends every step after it. A control that does more than it
    // says is a surprise, not a decision.
    expect(SECTION).toContain("Also ends:");
    expect(SECTION).toContain("title={neverTitle}");
  });

  it("reads implied from the producer's own origin, never re-deriving the chain here", () => {
    // lead-service takes the funnel from campaign-service and refuses a campaign that
    // states none. Re-deriving the order in the browser is a second source that can
    // disagree with what the campaign actually sells.
    expect(HOOK2).toContain('entry.origin !== "implied"');
    expect(HOOK2).not.toContain("chainIndex <");
  });

  it("treats a producer without origin as nothing implied", () => {
    // Exactly how this read behaved before the chain existed — no fabricated cascade.
    expect(HOOK2).toContain("Partial<Record<LeadStageKey, boolean>>");
  });

  it("says Won't happen, and states it once", () => {
    // "Never" read as a blank somebody had not filled in yet rather than as the
    // decision it is. The word is declared once so the button and the concluded pill
    // cannot come to say it two ways; the WIRE value is untouched.
    expect(SECTION).toContain('const WONT_LABEL = "Won\'t happen";');
    expect(SECTION).toContain("label={WONT_LABEL}");
    expect(SECTION).toContain('{state === "outcome" ? "Happened" : WONT_LABEL}');
    expect(SECTION).not.toContain('label="Never"');
    // The footer paragraph explaining the word is gone with it: a control that needs a
    // sentence under the card to be understood is a control that reads wrong.
    expect(SECTION).not.toContain("counts as no outcome");
    expect(SECTION).not.toContain("NEVER_TIP");
  });

  it("states what our sending did ABOVE the chain, read-only, and the page passes it", () => {
    // Delivery is measured, so there is nothing to state: no button, no picker. It
    // sits above the funnel because every chain starts after the email arrives. The
    // page half is what actually puts it on screen — a component that merely HANDLES
    // the prop renders nothing at all if nobody passes it.
    expect(SECTION).toContain("delivery?: ReactNode;");
    expect(SECTION).toContain("{delivery != null && (");
    expect(SECTION).toContain("{delivery}</span>");
    const call = PAGE.slice(PAGE.indexOf("<LeadFunnelStageSection"), PAGE.indexOf("<LeadFunnelStageSection") + 900);
    expect(call).toContain("delivery={<StatusBadge status={statusOf(selectedLead)} />}");
  });
});
