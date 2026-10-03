// What a booked meeting costs, for the Research page: two studies written from the four meeting
// dumps extract.sh pulls (meetings.csv, pilot-acted.csv, meeting-campaigns.csv, meeting-spend.csv).
//
//  - pilot-cost: the positive reply -> meeting booked LEG on its own (campaign-service leg_key
//    `conversation_to_meeting_booked`). Spend = what that leg's campaigns were charged. A meeting
//    counts for the leg when lead-service credits it to our outreach AND it was booked on or after
//    the leg first acted on that person (followup_actions).
//  - meeting-cost: the Meeting booked OUTCOME across every leg (first cold email to meeting).
//    Population = the brands that REPORT their meetings (any live meeting row, any source): a
//    brand with no CRM import and no tracker reads zero meetings by construction, and charging its
//    spend against nobody's meetings would invent a price (owner pick A, 2026-10-03). Spend = every
//    dollar those brands were charged on cold email and meeting booking; meetings = the ones
//    lead-service credits to our outreach.
//
// Maturity is features-service's, read off its channel catalogue (maturity.json): the leg's
// `outcomesRequired` decides Learning. Spend is what clients were charged (gross, actual rows),
// the basis of every other price on the page.
//
// Pure: no I/O, so tests/unit/research-meetings.test.ts runs it on fixtures.

export const PILOT_LEG = "conversation_to_meeting_booked";
export const OUTCOME_LEG = "start_to_meeting_booked";
const MEETING_FEATURE = "ai-meeting-booking";
const COLD_EMAIL_FEATURE = "sales-cold-email-outreach";
// A measurement on fewer brands than this describes those brands, not the fleet.
const MIN_BRANDS = 2;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
const dayText = (ymd) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
const n = (v) => Number(v).toLocaleString("en-US");
const usd = (v) => (Math.abs(v) < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
const meetingsText = (k) => `${n(k)} ${k === 1 ? "meeting" : "meetings"}`;
const brandsText = (k) => `${n(k)} ${k === 1 ? "brand" : "brands"}`;

function legRule(maturity, legKey) {
  const leg = maturity.find((l) => l.legKey === legKey);
  if (!leg) throw new Error(`maturity.json carries no rule for leg ${legKey}: features-service's /public/channels must state it`);
  return leg;
}

const inWindow = (ts, window) => ts.slice(0, 10) >= window.from && ts.slice(0, 10) < window.to;

/**
 * @param {object} input
 * @param {{conversion_id:string,brand_id:string,received_at:string,caused_by_outreach:string,matched_lead_id:string,source:string}[]} input.meetings
 * @param {{lead_id:string,brand_id:string,acting_campaign_id:string,acted_at:string}[]} input.acted
 * @param {{campaign_id:string,feature_slug:string,leg_key:string}[]} input.campaigns
 * @param {{campaign_id:string,brand_id:string,feature_slug:string,day:string,cents:string}[]} input.spend
 * @param {{legKey:string,durationDays:number,outcomesRequired:number}[]} input.maturity
 * @param {{from:string,to:string}} input.window  to is exclusive (the read day)
 * @param {"user"|"actual"} input.costBasis
 */
export function meetingStudies({ meetings, acted, campaigns, spend, maturity, window, costBasis }) {
  const pilotRule = legRule(maturity, PILOT_LEG);
  const outcomeRule = legRule(maturity, OUTCOME_LEG);
  const campaignById = new Map(campaigns.map((c) => [c.campaign_id, c]));
  // a spend row with no feature_slug is filed by its campaign; one no campaign names is not ours
  const featureOf = (s) => s.feature_slug || campaignById.get(s.campaign_id)?.feature_slug || "";
  const spendRows = spend
    .filter((s) => s.day >= window.from && s.day < window.to)
    .map((s) => ({ ...s, feature: featureOf(s), usd: Number(s.cents) / 100 }))
    .filter((s) => s.feature === COLD_EMAIL_FEATURE || s.feature === MEETING_FEATURE);
  const credited = meetings.filter((m) => m.caused_by_outreach === "true" && inWindow(m.received_at, window));

  // ---------- the leg: positive reply -> meeting booked ----------
  const pilotCampaigns = new Set(campaigns.filter((c) => c.leg_key === PILOT_LEG).map((c) => c.campaign_id));
  const pilotSpend = spendRows.filter((s) => pilotCampaigns.has(s.campaign_id)).reduce((t, s) => t + s.usd, 0);
  const firstActed = new Map();
  for (const a of acted) {
    if (!pilotCampaigns.has(a.acting_campaign_id)) continue;
    const prev = firstActed.get(a.lead_id);
    if (!prev || a.acted_at < prev) firstActed.set(a.lead_id, a.acted_at);
  }
  const pilotMeetings = credited.filter((m) => m.matched_lead_id && firstActed.has(m.matched_lead_id) && m.received_at >= firstActed.get(m.matched_lead_id));
  const pilotLearning = pilotMeetings.length < pilotRule.outcomesRequired;
  const pilotPrice = pilotMeetings.length ? pilotSpend / pilotMeetings.length : null;
  const pilotSample = `${meetingsText(pilotMeetings.length)} · ${usd(pilotSpend)} spent · ${n(firstActed.size)} ${firstActed.size === 1 ? "person" : "people"} acted on`;
  const pilot = {
    id: "pilot-cost",
    crew: "pilot",
    topic: "cost",
    goal: "roi",
    question: "What does a booked meeting cost on average?",
    status: pilotPrice === null ? "not_enough_data" : "measured",
    headline: pilotPrice === null
      ? "No meeting booked after this step acted yet."
      : `${usd(pilotPrice)} per meeting booked on this step alone, from a positive reply to the meeting.`,
    winner: null,
    crowned: false,
    result: pilotPrice === null ? null : { display: usd(pilotPrice), unit: "per meeting booked, this step only", sample: pilotSample },
    charts: pilotPrice === null ? [] : [{
      kind: "bars",
      title: "Cost per meeting booked, positive reply to meeting (USD, lower is better)",
      lowerIsBetter: true,
      points: [{ label: "Every campaign on this step", value: Number(pilotPrice.toFixed(2)), display: usd(pilotPrice), note: pilotSample, thin: pilotLearning }],
      note: `A meeting counts here when it was booked on or after this step first acted on that person, and our outreach gets the credit for it. A figure needs ${meetingsText(pilotRule.outcomesRequired)} behind it; below that it reads Learning.`,
    }],
    conclusion: [
      `Everything this step was charged (${usd(pilotSpend)}), divided by the meetings booked after it acted. The cold email that won the positive reply is not in this price: the Meeting booked section below counts it.`,
    ],
    verdict: pilotPrice === null
      ? { kind: "noise", reason: "No meeting booked after this step acted yet." }
      : { kind: "noise", reason: `Learning: ${meetingsText(pilotMeetings.length)} of the ${n(pilotRule.outcomesRequired)} a figure needs.` },
  };
  if (!pilotLearning) pilot.verdict = { kind: "signal", reason: `${meetingsText(pilotMeetings.length)} on this step, but one price is a measurement, not a comparison: no rival step to beat.` };
  if (pilot.status === "measured" && pilot.verdict.kind !== "conclusion") pilot.headline += pilot.verdict.kind === "signal" ? " A signal to confirm, not yet a conclusion." : " Noise so far.";

  // ---------- the outcome: first cold email -> meeting booked, every leg ----------
  const reporting = new Set(meetings.map((m) => m.brand_id).filter(Boolean));
  const popSpend = spendRows.filter((s) => reporting.has(s.brand_id));
  const popMeetings = credited.filter((m) => reporting.has(m.brand_id));
  const brandsWithSpend = new Set(popSpend.map((s) => s.brand_id));
  const totalSpend = popSpend.reduce((t, s) => t + s.usd, 0);
  // months from the first one carrying spend or a meeting to the read's month
  const months = [...new Set([...popSpend.map((s) => s.day.slice(0, 7)), ...popMeetings.map((m) => m.received_at.slice(0, 7))])].sort();
  const readMonth = window.to.slice(0, 7);
  const partialMonth = window.to.slice(8, 10) === "01" ? null : readMonth;
  const byMonth = months.map((ym) => ({
    ym,
    spend: popSpend.filter((s) => s.day.startsWith(ym)).reduce((t, s) => t + s.usd, 0),
    got: popMeetings.filter((m) => m.received_at.startsWith(ym)).length,
  }));
  const monthNote = (got, spent, ym, toDate) => `${meetingsText(got)} · ${usd(spent)} spent${toDate ? " to date" : ""}${ym === partialMonth ? " · month in progress" : ""}`;
  const monthPoints = byMonth.filter((r) => r.got > 0).map((r) => ({
    label: monthLabel(r.ym),
    value: Number((r.spend / r.got).toFixed(2)),
    display: usd(r.spend / r.got),
    note: monthNote(r.got, r.spend, r.ym, false),
    thin: r.got < outcomeRule.outcomesRequired,
    ...(r.ym === partialMonth ? { partial: true } : {}),
  }));
  let spent = 0, got = 0;
  const cumulative = [];
  for (const r of byMonth) {
    spent += r.spend; got += r.got;
    if (!got) continue;
    cumulative.push({
      label: monthLabel(r.ym),
      value: Number((spent / got).toFixed(2)),
      display: usd(spent / got),
      note: monthNote(got, spent, r.ym, true),
      thin: got < outcomeRule.outcomesRequired,
      ...(r.ym === partialMonth ? { partial: true } : {}),
    });
  }
  const outcomePrice = popMeetings.length ? totalSpend / popMeetings.length : null;
  const outcomeLearning = popMeetings.length < outcomeRule.outcomesRequired;
  const population = `Measured on the ${brandsText(reporting.size)} that ${reporting.size === 1 ? "reports its" : "report their"} booked meetings to us (CRM import or tracker): every dollar ${reporting.size === 1 ? "it was" : "they were"} charged on cold email and meeting booking, against every meeting our outreach gets the credit for. Brands that report no meetings are left out, since zero meetings there means we cannot see them.`;
  const outcomeSample = `${meetingsText(popMeetings.length)} · ${usd(totalSpend)} spent · ${brandsText(brandsWithSpend.size)}`;
  const outcome = {
    id: "meeting-cost",
    crew: null,
    outcome: "meeting",
    topic: "cost",
    goal: "roi",
    question: "What does a booked meeting cost, from the first cold email?",
    status: outcomePrice === null ? "not_enough_data" : "measured",
    headline: outcomePrice === null
      ? "No booked meeting credited to our outreach yet."
      : `${usd(outcomePrice)} per meeting booked on average since inception, every leg from the first cold email to the meeting.`,
    winner: null,
    crowned: false,
    result: outcomePrice === null ? null : { display: usd(outcomePrice), unit: "per meeting booked, all legs, average since inception", sample: outcomeSample },
    charts: outcomePrice === null ? [] : [{
      kind: "months",
      title: "Brands reporting meetings: cost per meeting booked by month",
      lowerIsBetter: true,
      points: monthPoints,
      cumulative: { title: "Brands reporting meetings: average since inception", points: cumulative },
      note: `Spend on cold email and meeting booking from ${dayText(window.from)} to the read (${dayText(window.to)}), against the meetings booked in the same window. A figure needs ${meetingsText(outcomeRule.outcomesRequired)} behind it; below that it reads Learning.`,
    }],
    conclusion: [
      "The average divides everything those brands were charged, positive reply leg and meeting leg alike, by every meeting booked since; the monthly bars are context, not the answer.",
    ],
    verdict: outcomePrice === null
      ? { kind: "noise", reason: "No booked meeting credited to our outreach yet." }
      : outcomeLearning
        ? { kind: "noise", reason: `Learning: ${meetingsText(popMeetings.length)} of the ${n(outcomeRule.outcomesRequired)} a figure needs.` }
        : brandsWithSpend.size < MIN_BRANDS
          ? { kind: "signal", reason: `${meetingsText(popMeetings.length)}, all from ${brandsText(brandsWithSpend.size)}: a measurement of that brand, not yet of the fleet.` }
          : { kind: "conclusion", reason: `A measurement on ${meetingsText(popMeetings.length)} across ${brandsText(brandsWithSpend.size)}.` },
  };
  if (outcome.status === "measured" && outcome.verdict.kind !== "conclusion") outcome.headline += outcome.verdict.kind === "signal" ? " A signal to confirm, not yet a conclusion." : " Noise so far.";
  outcome.crowned = outcome.verdict.kind === "conclusion";

  // The vendor cost of these campaigns is not in the meeting dumps: the staff actual basis says so
  // instead of pricing a meeting at what clients paid.
  if (costBasis === "actual") {
    for (const st of [pilot, outcome]) {
      Object.assign(st, {
        status: "not_enough_data",
        headline: "Not measured on vendor cost yet.",
        result: null,
        charts: [],
        conclusion: ["The meeting figures are on what clients were charged only. Switch to the billed basis to read them."],
        verdict: { kind: "noise", reason: "Not measured on vendor cost yet." },
        crowned: false,
      });
    }
  }

  return {
    outcomes: [{ id: "meeting", outcome: "Meeting booked", description: "One outcome across every leg, from the first cold email to the meeting.", population }],
    studies: [pilot, outcome],
  };
}
