// What our typed judgments (Jev, TypeSafe's jev-1.13.0 behind chat-service /orgs/judgments and
// /internal/platform-judgments) do, for the Research page: four studies in the "Typed judgment"
// OUTCOME section, written from the dumps extract.sh pulls (jev-*.csv).
//
//  - jev-volume: every judgment billed, per month and per asking service, and what one costs.
//  - jev-screen-decline: the lead screen. Every person Apollo returns is judged against the
//    client's own audience text BEFORE the paid reveal; a person passes only at P(yes) > 0.5.
//    Declined = P(yes) <= 0.5, the bar in force today (it was 0.8 until 2026-09-29: the people
//    between 0.5 and 0.8 that bar declined are counted as passes here, never as declines).
//  - jev-screen-price: screening one person against revealing one, both as billed.
//  - jev-machine-replies: who wrote a cold email reply, as the reply classifier labelled it. It is
//    the population a bot-or-human judgment acts on; Jev itself runs there in shadow.
//
// A count or a share is a MEASUREMENT, not a comparison: its verdict is a conclusion when it rests
// on at least MIN_OUTCOMES events across at least MIN_ORGS clients, a signal on one client, noise
// below (the same words as verdict.mjs and meetings.mjs). Spend is what clients were billed.
//
// Pure: no I/O, so tests/unit/research-jev.test.ts runs it on fixtures.
import { MIN_OUTCOMES } from "./verdict.mjs";

export const OUTCOME_ID = "judgment";
const MIN_ORGS = 2;
const BUCKETS = [
  ["lt20", "Below 20%"],
  ["lt50", "20 to 50%"],
  ["lt80", "50 to 80%"],
  ["ge80", "80% and up"],
];
const MACHINE_KINDS = new Map([
  ["lead_out_of_office", "Out of office"],
  ["auto_reply_received", "Other auto-reply"],
]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
const n = (v) => Math.round(Number(v)).toLocaleString("en-US");
const pct = (v) => (v > 0 && v < 0.01 ? "<1%" : `${Math.round(v * 100)}%`);
const usd = (v) => (v < 0.01 ? `$${v.toFixed(4)}` : v < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);

// Wilson 95% interval on a share
function wilson(k, total) {
  if (!total) return null;
  const z = 1.96, p = k / total, d = 1 + (z * z) / total;
  const c = p + (z * z) / (2 * total), h = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return { lo: (c - h) / d, hi: (c + h) / d };
}

function measurementVerdict(events, orgs, what) {
  if (events < MIN_OUTCOMES) return { kind: "noise", reason: `${n(events)} ${what}: a figure needs at least ${MIN_OUTCOMES}.` };
  if (orgs < MIN_ORGS) return { kind: "signal", reason: `${n(events)} ${what}, all from one client: a measurement of that client, not yet of the fleet.` };
  return { kind: "conclusion", reason: `A measurement on ${n(events)} ${what} across ${n(orgs)} clients, not a comparison.` };
}

const withVerdict = (study, verdict) => {
  const s = { ...study, verdict, crowned: verdict.kind === "conclusion" };
  if (verdict.kind !== "conclusion") s.headline += verdict.kind === "signal" ? " A signal to confirm, not yet a conclusion." : " Noise so far.";
  return s;
};

/**
 * @param {object} input
 * @param {{month:string,route:string,asker:string,judgments:string,tokens:string,cents:string}[]} input.runs
 * @param {{org_id:string}[]} input.runOrgs  distinct orgs that asked an org-billed judgment
 * @param {{screen:string,month:string,bucket:string,verdict:string,people:string}[]} input.screens
 * @param {{org_id:string,audience_id:string}[]} input.reach
 * @param {{credits:string,cents:string}} input.reveal
 * @param {{kind:string,replies:string}[]} input.replyKinds
 * @param {{org_id:string}[]} input.replyOrgs
 * @param {{from:string,to:string}} input.window  to is exclusive (the read day)
 * @param {"user"|"actual"} [input.costBasis]  the prices here are what clients were billed; on the
 *   staff vendor-cost twin the two priced studies say so instead of relabelling a billed price
 */
export function jevStudies({ runs, runOrgs, screens, reach, reveal, replyKinds, replyOrgs, window, costBasis = "user" }) {
  const lastMonth = window.to.slice(8, 10) === "01" ? null : window.to.slice(0, 7);
  const note = "Every judgment billed since Jev went live on Sep 19, 2026, to the read day. A count needs no maturity wait; the month the read day falls in is still running, drawn dotted.";

  // ---------- volume ----------
  const total = runs.reduce((a, r) => a + Number(r.judgments), 0);
  const tokens = runs.reduce((a, r) => a + Number(r.tokens), 0);
  const cents = runs.reduce((a, r) => a + Number(r.cents), 0);
  const byMonth = new Map();
  for (const r of runs) byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + Number(r.judgments));
  const months = [...byMonth.keys()].sort();
  const ASKER = { "lead-service": "Lead screens", google: "Inbox triage", "crm-service": "CRM reads", "": "Platform jobs" };
  const byAsker = new Map();
  for (const r of runs) {
    const k = r.route === "platform-judgments" ? "Platform jobs" : ASKER[r.asker] ?? "Other questions";
    byAsker.set(k, (byAsker.get(k) ?? 0) + Number(r.judgments));
  }
  const perThousand = total ? cents / 100 / (total / 1000) : 0;
  const volume = withVerdict({
    id: "jev-volume",
    crew: null,
    outcome: OUTCOME_ID,
    topic: "judgment",
    goal: "rate",
    question: "How many typed judgments do our pipes ask, and what does one cost?",
    status: "measured",
    headline: `${n(total)} judgments since Sep 19, 2026, at ${usd(perThousand)} per 1,000 as billed.`,
    winner: null,
    result: { display: n(total), unit: "typed judgments since Sep 19, 2026", sample: `${n(tokens / 1e6)}M input tokens · ${usd(perThousand)} per 1,000 judgments billed · output free` },
    charts: [
      {
        kind: "bars",
        title: "Judgments by month",
        lowerIsBetter: false,
        points: months.map((m) => ({ label: monthLabel(m), value: byMonth.get(m), display: n(byMonth.get(m)), note: m === lastMonth ? "month in progress" : "", thin: false, ...(m === lastMonth ? { partial: true } : {}) })),
        note,
      },
      {
        kind: "bars",
        title: "Who asks",
        lowerIsBetter: false,
        points: [...byAsker.entries()].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, value: v, display: n(v), note: `${pct(v / total)} of all judgments`, thin: false })),
        note,
      },
    ],
    conclusion: [
      "A judgment is one typed question about one piece of text, answered with a probability: yes or no, one choice among options, or a level.",
      "The bill is input tokens only; Jev charges nothing for its answer.",
    ],
  }, measurementVerdict(total, runOrgs.length, "judgments"));

  // ---------- the lead screen ----------
  const people = screens.reduce((a, r) => a + Number(r.people), 0);
  const inBucket = (b) => screens.filter((r) => r.bucket === b).reduce((a, r) => a + Number(r.people), 0);
  const declined = inBucket("lt20") + inBucket("lt50");
  const oldBarLost = screens.filter((r) => r.bucket === "lt80" && r.verdict === "decline").reduce((a, r) => a + Number(r.people), 0);
  const orgs = new Set(reach.map((r) => r.org_id)).size;
  const audiences = new Set(reach.map((r) => `${r.org_id}|${r.audience_id}`)).size;
  const ci = wilson(declined, people);
  const decline = withVerdict({
    id: "jev-screen-decline",
    crew: null,
    outcome: OUTCOME_ID,
    topic: "judgment",
    goal: "rate",
    question: "How many people does the lead screen turn away before we pay to reveal them?",
    status: "measured",
    headline: `${pct(declined / people)} of the people Apollo returns are turned away before the paid reveal.`,
    winner: null,
    result: { display: pct(declined / people), unit: "turned away before the paid reveal", sample: `${n(declined)} of ${n(people)} people · ${n(audiences)} audiences · ${n(orgs)} clients` },
    charts: [
      {
        kind: "bars",
        title: "People screened, by Jev's probability that they fit the audience",
        lowerIsBetter: false,
        points: BUCKETS.map(([b, label]) => {
          const v = inBucket(b);
          return { label, value: v, display: n(v), note: `${pct(v / people)} · ${b === "lt20" || b === "lt50" ? "turned away" : "revealed"}`, thin: false };
        }),
        note: "Each person is judged once against the audience the client described, before any paid step. A person passes above 50%.",
      },
    ],
    conclusion: [
      `A pass needs a probability above 50%. ${pct(declined / people)} stay at or under it, 95% interval ${pct(ci.lo)} to ${pct(ci.hi)}.`,
      `${n(inBucket("lt20") + inBucket("ge80"))} of ${n(people)} answers (${pct((inBucket("lt20") + inBucket("ge80")) / people)}) are below 20% or at 80% and up: Jev is sure on most people.`,
      `Only the people kept are revealed, so the same budget reaches ${(people / (people - declined)).toFixed(1)}x more people who fit than revealing the whole list.`,
      `Until Sep 29, 2026 the bar was 80%. ${n(oldBarLost)} people between 50% and 80% were turned away under it; they count as passes here.`,
    ],
  }, measurementVerdict(declined, orgs, "people turned away"));

  // ---------- screen price against reveal price ----------
  const screenRuns = runs.filter((r) => r.route === "judgments" && r.asker === "lead-service");
  const screenJudgments = screenRuns.reduce((a, r) => a + Number(r.judgments), 0);
  const screenUsd = screenRuns.reduce((a, r) => a + Number(r.cents), 0) / 100 / screenJudgments;
  const revealUsd = Number(reveal.cents) / 100 / Number(reveal.credits);
  const ratio = revealUsd / screenUsd;
  const price = withVerdict({
    id: "jev-screen-price",
    crew: null,
    outcome: OUTCOME_ID,
    topic: "judgment",
    goal: "roi",
    question: "What does screening one person cost, against revealing one?",
    status: "measured",
    headline: `Screening a person costs ${n(ratio)}x less than revealing one.`,
    winner: null,
    result: { display: `${n(ratio)}x`, unit: "cheaper to screen a person than to reveal one", sample: `${usd(screenUsd * 1000)} per 1,000 screens · ${usd(revealUsd)} per reveal · ${n(screenJudgments)} screens, ${n(Number(reveal.credits))} reveals` },
    charts: [
      {
        kind: "bars",
        title: "Billed per person",
        lowerIsBetter: true,
        points: [
          { label: "Screen (Jev)", value: screenUsd, display: usd(screenUsd), note: `${n(screenJudgments)} screens`, thin: false },
          { label: "Reveal (Apollo)", value: revealUsd, display: usd(revealUsd), note: `${n(Number(reveal.credits))} credits`, thin: false },
        ],
        note: "Both as billed to clients. A reveal is one Apollo enrichment credit, billed since Sep 28, 2026, when the screen started.",
      },
    ],
    conclusion: [
      "Every person turned away by the screen is a reveal nobody pays for.",
      "Not every pass becomes a paid reveal (no email found, already reached), so the saving is counted per screen, never as a total.",
    ],
  }, measurementVerdict(screenJudgments, orgs, "screens"));

  // ---------- who wrote the reply ----------
  const replies = replyKinds.filter((r) => r.kind).reduce((a, r) => a + Number(r.replies), 0);
  const byKind = new Map();
  for (const r of replyKinds.filter((x) => x.kind)) {
    const k = MACHINE_KINDS.get(r.kind) ?? "A person";
    byKind.set(k, (byKind.get(k) ?? 0) + Number(r.replies));
  }
  const machine = replies - (byKind.get("A person") ?? 0);
  const mci = wilson(machine, replies);
  const machineStudy = withVerdict({
    id: "jev-machine-replies",
    crew: null,
    outcome: OUTCOME_ID,
    topic: "judgment",
    goal: "rate",
    question: "How many cold email replies come from a machine, not a person?",
    status: "measured",
    headline: `${pct(machine / replies)} of our cold email replies are written by a machine.`,
    winner: null,
    result: { display: pct(machine / replies), unit: "of replies written by a machine", sample: `${n(machine)} of ${n(replies)} replies` },
    charts: [
      {
        kind: "bars",
        title: "Cold email replies, by who wrote them",
        lowerIsBetter: false,
        points: [...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, value: v, display: n(v), note: pct(v / replies), thin: false })),
        note: "Every reply to our cold emails, labelled by the reply classifier. A reply rate that counts them all counts the machines too.",
      },
    ],
    conclusion: [
      `${pct(machine / replies)} of replies are out-of-office or other auto-replies, 95% interval ${pct(mci.lo)} to ${pct(mci.hi)}.`,
      "Jev answers the same question in shadow beside the classifier; it decides nothing on cold email replies yet.",
    ],
  }, measurementVerdict(machine, replyOrgs.length, "machine replies"));

  // the vendor-cost twin (staff only): a billed price is not a vendor cost, so say it is not measured there
  const unpriced = (s) => ({ ...s, status: "not_enough_data", headline: "Not measured on vendor cost yet.", result: null, charts: [], crowned: false, verdict: { kind: "noise", reason: "Not measured on vendor cost yet." }, conclusion: ["Read this study on the billed basis."] });
  const priced = costBasis === "actual" ? [unpriced(volume), decline, unpriced(price)] : [volume, decline, price];
  return {
    studies: [...priced, machineStudy],
    outcomes: [
      {
        id: OUTCOME_ID,
        outcome: "Typed judgment",
        description: "One typed question about one piece of text, answered with a probability (Jev 1.13).",
        population: "Every judgment our pipes billed since Jev went live on Sep 19, 2026, every client. The reply study reads every reply to our cold emails.",
      },
    ],
  };
}
