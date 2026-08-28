import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const PAGE = read("src/components/audiences/engaged-leads-page.tsx");
const SECTION = read("src/components/leads/lead-funnel-stage-section.tsx");
const HOOK = read("src/lib/use-lead-step-statements.ts");
const API = read("src/lib/api.ts");

describe("lead funnel stage panel", () => {
  it("keys the control set on the campaign's FUNNEL, never on a goal", () => {
    // `sales_meetings` covers both meeting funnels, so a goal cannot say whether the
    // funnel starts at a reply or at a website visit — the exact distinction this panel
    // records. The campaign has stated its funnelKey since #3344.
    const slice = PAGE.slice(PAGE.indexOf("const panelFunnel ="), PAGE.indexOf("const onSetStage ="));
    expect(slice).toContain("activeFunnelKeys[0]");
    expect(slice).toContain("leadFunnelLegStages(panelFunnel.key, panelLeg)");
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

  it("takes a statement back through the producer's own withdrawal, never the opposite one", () => {
    // Stating "won't happen" to cancel a mistaken "happened" is itself a false
    // statement, and it keeps counting. lead-service withdraws instead: the ABSENCE of
    // a statement, not a third kind of one.
    expect(HOOK).toContain("withdrawLeadStepStatement");
    expect(API).toContain('method: "DELETE"');
    expect(API).toContain("/step-statements/${step}");
    // Not a state anything renders or counts.
    expect(SECTION).not.toContain('=== "outcome" ? "pending"');
    expect(SECTION).not.toContain('=== "never" ? "pending"');
  });

  it("offers the withdrawal only on somebody's OWN words", () => {
    // A tracker reported it, or the funnel implies it from a statement on another step:
    // lead-service refuses both (409 not_a_statement / nothing_stated), and the honest
    // surface for a refusal we can predict is not offering the control.
    expect(HOOK).toContain("export function withdrawableStages");
    expect(HOOK).toContain('entry.origin !== "stated"');
    expect(HOOK).toContain('entry.source !== "manual"');
    expect(SECTION).toContain("const canWithdraw = withdrawable?.[stage.key] === true && onWithdraw != null;");
    // The CALL SITE, not only the component that would honour it.
    const call = PAGE.slice(PAGE.indexOf("<LeadFunnelStageSection"), PAGE.indexOf("<LeadFunnelStageSection") + 1200);
    expect(call).toContain("withdrawable={panelWithdrawable}");
    expect(call).toContain("onWithdraw={onWithdrawStage}");
  });

  it("re-reads after a WRITE instead of reconstructing the producer's answer", () => {
    // lead-service decides more than the field written: an outcome can supersede an
    // earlier `never`, and it stamps source, user and time. Measured to the closing
    // brace of the two write hooks so the withdrawal below is not in the slice.
    const writes = HOOK.slice(
      HOOK.indexOf("export function useSetLeadStepStatement"),
      HOOK.indexOf("export function useWithdrawLeadStepStatement"),
    );
    expect(writes).toContain("invalidateQueries");
    expect(writes).not.toContain("setQueryData");
  });

  it("writes the WITHDRAWAL's own answer into the cache rather than re-reading it", () => {
    // The producer re-derives every step and returns the read's own shape, because one
    // withdrawal moves OTHER steps: a step that only read as reached falls back to what
    // the rest imply, and a "never" the outcome had superseded stands again. A re-read
    // would be a second round trip spent learning what it just told us.
    const withdraw = HOOK.slice(
      HOOK.indexOf("export function useWithdrawLeadStepStatement"),
      HOOK.indexOf("export function useSetAnyLeadStepStatement"),
    );
    expect(withdraw).toContain("setQueryData(leadStepStatementsQueryKey");
    expect(withdraw).toContain('queryKey: ["featureRevenue"]');
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

  it("re-picking the stated kind TAKES IT BACK, which is the only way out", () => {
    // The vocabulary has no "nothing stated" member to pick instead, and the producer is
    // idempotent on the standing value, so re-picking was a deliberate no-op and a person
    // who chose wrongly was stuck with it. The gesture anybody reaches for to undo a
    // choice is the choice itself.
    expect(CONTROL).toContain("if (o.kind !== kind) onSet(o.kind);");
    expect(CONTROL).toContain("else onWithdraw?.();");
    // Said out loud on the row: a control whose behaviour is "press what you already
    // pressed" is not discoverable from the thing itself.
    expect(CONTROL).toContain("Clear");
  });

  it("only offers it while something STANDS, and drops a withdrawn statement from the read", () => {
    // The list serves withdrawn statements beside standing ones - they are the audit of
    // what was asserted - so taking the newest row verbatim renders a kind nobody stands
    // behind, which is the whole point of taking it back.
    expect(PAGE).toContain("replyData?.qualifications.find((q) => !q.withdrawnAt)?.replyKind");
    expect(PAGE).toContain("if (q.withdrawnAt) continue;");
    const call = PAGE.slice(PAGE.indexOf("<LeadFunnelStageSection"), PAGE.indexOf("<LeadFunnelStageSection") + 1200);
    expect(call).toContain("onWithdraw: shownReplyKind ? onWithdrawReply : undefined");
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

  it("still re-reads the funnel from the producer, never deriving it here", () => {
    // lead-service decides more than the field written — an outcome supersedes an
    // earlier never, and the cascade is its answer. The pending statement covers one
    // row while that read lands; it does not replace it.
    expect(HOOK).toContain("invalidateQueries");
    expect(PAGE).not.toContain("stepIndex <");
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
    // Only on an OUTCOME: the producer refuses a value attached to a "never".
    expect(SECTION).toContain('needsValue={asking.next === "outcome" && stageRequiresValue(stage.key)}');
  });

  it("cannot submit the amount form until what was typed IS an amount", () => {
    expect(SECTION).toContain("saleValueCentsFrom(rawValue)");
    expect(SECTION).toContain("const ready = costCents != null && (!needsValue || valueCents != null);");
    expect(SECTION).toContain("disabled={!ready || busy}");
  });

  it("reads the recorded amount back where it was typed", () => {
    expect(SECTION).toContain('data-testid="lead-funnel-stage-value"');
    expect(PAGE).toContain("stageValuesFrom(stepStatements)");
    expect(PAGE).toContain("values={panelValues}");
  });

  it("sends the amount only when the control asked for one", () => {
    // A `never` carries no value and the producer refuses one, so the key is omitted
    // rather than sent empty. The COST rides along either way.
    expect(PAGE).toContain("? { step: key, kind: next, costCents }");
    expect(PAGE).toContain(": { step: key, kind: next, costCents, valueCents }");
  });
});

describe("stating what the step cost the customer", () => {
  const STAGES = read("src/lib/lead-funnel-stages.ts");

  it("asks on BOTH kinds, because a step that went nowhere still cost something", () => {
    // lead-service makes the cost mandatory on an outcome and on a "never" alike, so
    // neither button can write straight through any more.
    expect(SECTION).toContain(': setAsking({ key: stage.key as WritableStageKey, next: "outcome" })');
    expect(SECTION).toContain(': setAsking({ key: stage.key as WritableStageKey, next: "never" })');
    // The one-click write is GONE, so nothing can reach the producer without an amount.
    expect(SECTION).not.toContain(': onSet(stage.key as WritableStageKey, "outcome")');
    expect(SECTION).not.toContain('onClick={() => onSet(stage.key as WritableStageKey, "never")}');
  });

  it("blocks the write until the person answers, and defaults nothing for them", () => {
    // A blank field is an unanswered question, never a zero somebody did not type.
    expect(SECTION).toContain("stepCostCentsFrom(rawCost)");
    expect(SECTION).toContain("if (costCents == null) return;");
    expect(SECTION).not.toContain("costCents ?? 0");
    expect(SECTION).not.toContain("costCents: 0");
    expect(PAGE).not.toContain("costCents: 0");
  });

  it("makes the cost REQUIRED on the write, so a caller has to ask", () => {
    expect(API).toContain("costCents: number;");
    expect(API).not.toContain("costCents?: number");
  });

  it("reads the cost back required-and-nullable, matching the producer", () => {
    // `.optional()` would read undefined on a body that legitimately carries a null,
    // which is the one distinction this field exists to hold.
    expect(API).toContain("costCents: z.number().nullable(),");
    expect(API).not.toContain("costCents: z.number().nullable().optional()");
  });

  it("keeps a stated zero apart from a statement nobody was asked for", () => {
    // Presence, not value: absent means nobody stated the stage by hand, null means the
    // statement predates the question, 0 means somebody answered zero.
    expect(HOOK).toContain("typeof entry.costCents === \"number\" ? entry.costCents : null");
    expect(SECTION).toContain("const statedCost = costs && stage.key in costs ? costs[stage.key] ?? null : undefined;");
    expect(SECTION).toContain('statedCost === null ? "Cost not stated"');
  });

  it("puts the recorded cost on screen, and the page passes it", () => {
    // A component that merely HANDLES the prop renders nothing if nobody passes it.
    expect(SECTION).toContain('data-testid="lead-funnel-stage-cost"');
    expect(PAGE).toContain("stageCostsFrom(stepStatements)");
    const call = PAGE.slice(PAGE.indexOf("<LeadFunnelStageSection"), PAGE.indexOf("<LeadFunnelStageSection") + 900);
    expect(call).toContain("costs={panelCosts}");
  });

  it("says whose money it is beside the field, not only inside a tooltip", () => {
    // A dollar box on a screen that also shows credits reads as something we are about
    // to charge, and nobody opens a tooltip to find out otherwise.
    expect(SECTION).toContain('const COST_CAPTION = "Your own spend. We never bill it.";');
    expect(SECTION).toContain('data-testid="lead-funnel-stage-cost-caption"');
    expect(SECTION).toContain("we never charge you for it");
  });

  it("never presents it as platform spend, credits or an invoice", () => {
    // The COPY only, not the comments around it: a comment explaining that a dollar box
    // must not read as credits legitimately writes the word.
    const copy = [
      SECTION.slice(SECTION.indexOf("const COST_TIP"), SECTION.indexOf("\n\n", SECTION.indexOf("const COST_TIP"))),
      SECTION.slice(SECTION.indexOf("const COST_CAPTION"), SECTION.indexOf(";", SECTION.indexOf("const COST_CAPTION"))),
    ].join(" ").toLowerCase();
    for (const forbidden of ["credit", "invoice", "billed to you", "we charge you", "balance"]) {
      expect(copy).not.toContain(forbidden);
    }
    // And it says the opposite, in the author's own terms.
    expect(copy).toContain("this is your money");
    expect(copy).toContain("we never charge you");
  });

  it("surfaces the producer's own refusal, cost_required included", () => {
    // lead-service writes its 400 as a sentence for a person to read; the helper
    // forwards it rather than replacing it with a generic failure.
    expect(STAGES).toContain("if ((status === 400 || status === 409) && typeof upstream === \"string\"");
    expect(PAGE).toContain("leadStepErrorMessage(err)");
  });
});

describe("the funnel constrains its neighbours", () => {
  const HOOK2 = read("src/lib/use-lead-step-statements.ts");

  it("renders a step the FUNNEL concluded as an answer, with no control", () => {
    // A funnel is ORDERED: a never ends every later step, an outcome reaches every
    // earlier one. Nobody stated those, so offering a button would invite somebody to
    // state a thing already concluded, which would move on its own the moment the
    // statement behind it changed.
    expect(SECTION).toContain("const isImplied = implied?.[stage.key] === true;");
    expect(SECTION).toContain("{isImplied ? (");
  });

  it("says what ending a step also ends, BEFORE it is clicked", () => {
    // One click mid-funnel ends every step after it. A control that does more than it
    // says is a surprise, not a decision.
    expect(SECTION).toContain("Also ends:");
    expect(SECTION).toContain(": neverTitle");
  });

  it("reads implied from the producer's own origin, never re-deriving the funnel here", () => {
    // lead-service takes the funnel from campaign-service and refuses a campaign that
    // states none. Re-deriving the order in the browser is a second source that can
    // disagree with what the campaign actually sells.
    expect(HOOK2).toContain('entry.origin !== "implied"');
    expect(HOOK2).not.toContain("stepIndex <");
  });

  it("treats a producer without origin as nothing implied", () => {
    // Exactly how this read behaved before the funnel existed — no fabricated cascade.
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

  it("states what our sending did ABOVE the funnel, read-only, and the page passes it", () => {
    // Delivery is measured, so there is nothing to state: no button, no picker. It
    // sits above the steps because every funnel starts after the email arrives. The
    // page half is what actually puts it on screen — a component that merely HANDLES
    // the prop renders nothing at all if nobody passes it.
    expect(SECTION).toContain("delivery?: ReactNode;");
    expect(SECTION).toContain("{delivery != null && (");
    expect(SECTION).toContain("{delivery}</span>");
    const call = PAGE.slice(PAGE.indexOf("<LeadFunnelStageSection"), PAGE.indexOf("<LeadFunnelStageSection") + 900);
    expect(call).toContain("delivery={<StatusBadge status={statusOf(selectedLead)} />}");
  });
});


describe("the panel walks the campaign's OWN arrow, not the whole funnel", () => {
  it("resolves the leg from the campaign's channel and passes the leg-scoped stages", () => {
    // A campaign is (offer x funnel x channel) and performs ONE of the funnel's
    // arrows. The channel is its own feature slug and its legs ride the acquisition
    // catalogue the page already holds, so this costs no extra request.
    expect(PAGE).toContain("campaignLegFor(panelFunnel, channel?.legs)");
    // The channel is the CAMPAIGN's own, read through the one narrowing every
    // campaign surface shares — never the brand's sole GA feature, which resolves a
    // different channel's legs for any campaign that is not on it.
    expect(PAGE).toContain("acquisitionChannelForFeatureSlug(featureSlug, channels)");
    expect(PAGE).toContain("useScopedFeatureSlug(campaignId)");
    expect(PAGE).toContain("leadFunnelLegStages(panelFunnel.key, panelLeg)");
    // The full-funnel reader is gone from this page: keeping it beside the leg walk is
    // how the two come to disagree about which rows the panel offers.
    expect(PAGE).not.toContain("leadFunnelStages(panelFunnel.key)");
  });

  it("passes the funnel's LATER stages to the CALL SITE, not only to the component", () => {
    // A prop the component honours and the page never passes is the feature entirely
    // absent with the component perfectly correct.
    const at = PAGE.indexOf("<LeadFunnelStageSection");
    expect(at).toBeGreaterThan(-1);
    expect(PAGE.slice(at, at + 800)).toContain("laterStages={panelWalk.later}");
  });

  it("names the whole funnel's cascade in the Won't-happen title, not just the rendered rows", () => {
    // lead-service cascades a `never` across the WHOLE funnel, so a message built from
    // the rendered rows alone understates what one click ends.
    expect(SECTION).toContain("...stages.slice(stageIndex + 1), ...(laterStages ?? [])");
    // And `laterStages` is never DRAWN — it exists for that sentence alone.
    expect(SECTION).not.toContain("laterStages.map(");
  });
});
