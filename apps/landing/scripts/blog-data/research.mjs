#!/usr/bin/env node
// Writes the dataset the staff Research page (dashboard v2) renders, from the SAME fact table the
// data articles are derived from, so a study and an article can never state two figures for one
// population. Every study is fleet-wide (all orgs). The page divides nothing: every value, every
// label and every sentence it shows is written here.
//
//   node research.mjs /tmp/research-data/facts.json > apps/dashboard/src/lib/research/research.json
//
// Definitions (stated on the page under "How we measured"):
//  - ROI is read as COST PER OUTCOME: every crew buys one outcome, so the cheaper outcome is the
//    better return. Herald's outcome is a positive reply, Scout's a website visit (priced on the
//    emails that carried a link, since a visit cannot come from an email without one).
//  - A RATE is outcomes per 10,000 emails (Herald) or per 1,000 link-carrying emails (Scout).
//  - A winner is only CROWNED past the strict floors the articles use for their best workflow;
//    below them the page names a LEADER and says the counts are too thin to call.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: research.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
if (!facts.research) throw new Error("facts.json carries no research block: re-run derive.mjs");
const pixel = JSON.parse(
  execFileSync("node", [join(here, "pixel/derive-pixel.mjs"), join(here, "pixel/pixel.snapshot.json")], { encoding: "utf8" }),
);

const STRICT = facts.floors.bestWorkflow;
const n = (v) => Number(v).toLocaleString("en-US");
const usd = (v) => (Math.abs(v) < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The window sits inside one year, so a month reads alone; a second year would need it stated.
const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];

// A template id reads as `cold-email-v12`; the page shows it in words, the version kept since two
// versions of one template are different prompts.
function templateLabel(id) {
  const m = /^(.*?)(?:-v(\d+))?(-landing)?$/.exec(id);
  const base = (m[1] || id).replace(/^blind-discovery-email$/, "blind-discovery").replace(/-/g, " ");
  const words = base.charAt(0).toUpperCase() + base.slice(1);
  return `${words}${m[2] ? ` v${m[2]}` : ""}${m[3] ? " (landing)" : ""}`;
}

// ---------- the two outcomes ----------
const OUTCOMES = {
  reply: {
    crew: "herald",
    noun: "positive reply",
    nounPlural: "positive replies",
    count: "replies",
    cost: "cpr",
    costThin: "cprThin",
    rate: "repliesPerTenThousand",
    rateUnit: "per 10,000 emails",
    rateShort: "/10k",
    strictOutcomes: STRICT.minReplies,
    emailsNoun: "emails",
  },
  visit: {
    crew: "scout",
    noun: "website visit",
    nounPlural: "website visits",
    count: "clicks",
    cost: "cpc",
    costThin: "cpcThin",
    rate: "clicksPerThousand",
    rateUnit: "per 1,000 emails with a link",
    rateShort: "/1k",
    strictOutcomes: STRICT.minClicks,
    emailsNoun: "emails with a link",
  },
};

const counts = (o, row) => `${n(row[o.count])} ${row[o.count] === 1 ? o.noun : o.nounPlural} · ${n(row.emails)} ${o.emailsNoun}`;
const rateText = (o, v) => `${v.toFixed(1)} ${o.rateShort}`;

// A bar is THIN below the same floors that crown a winner, so the chart and the headline agree:
// a cheap price on one lucky reply sits below the winner, marked, never above it.
const costThinStrict = (o, r) => r.emails < STRICT.minEmails || r[o.count] < o.strictOutcomes;
// Costs: eligible bars cheapest first, then the thin ones; a row with no outcome has no price.
function costBars(o, rows, label = (b) => b, { ordinal = false } = {}) {
  const priced = rows.filter((r) => r[o.cost] !== null);
  const ordered = ordinal ? priced : [...priced].sort((a, b) => Number(costThinStrict(o, a)) - Number(costThinStrict(o, b)) || a[o.cost] - b[o.cost]);
  return ordered.map((r) => ({
    label: label(r.bucket),
    value: r[o.cost],
    display: usd(r[o.cost]),
    note: counts(o, r),
    thin: costThinStrict(o, r),
  }));
}
// Rates: a zero is a measured zero and is drawn; a bucket under the email floor is thin.
function rateBars(o, rows, label = (b) => b, { ordinal = false } = {}) {
  const drawn = rows.filter((r) => r.emails >= facts.floors.minEmails);
  const ordered = ordinal ? drawn : [...drawn].sort((a, b) => b[o.rate] - a[o.rate]);
  return ordered.map((r) => ({
    label: label(r.bucket),
    value: r[o.rate],
    display: rateText(o, r[o.rate]),
    note: counts(o, r),
    thin: r.emails < STRICT.minEmails,
  }));
}

// The winner on cost: crowned only past the strict floors; otherwise the cheapest priced row is a
// LEADER, and the sentence says the counts are too thin to call it.
function costWinner(o, rows) {
  const strict = rows.filter((r) => r[o.cost] !== null && r.emails >= STRICT.minEmails && r[o.count] >= o.strictOutcomes);
  if (strict.length) return { row: [...strict].sort((a, b) => a[o.cost] - b[o.cost])[0], crowned: true };
  const priced = rows.filter((r) => r[o.cost] !== null);
  if (!priced.length) return null;
  return { row: [...priced].sort((a, b) => a[o.cost] - b[o.cost])[0], crowned: false };
}
function rateWinner(o, rows) {
  const strict = rows.filter((r) => r.emails >= STRICT.minEmails);
  if (!strict.length) return null;
  return { row: [...strict].sort((a, b) => b[o.rate] - a[o.rate] || b.emails - a.emails)[0], crowned: strict.some((r) => r[o.count] > 0) };
}

function monthLine(o, series, kind) {
  if (!series) return [];
  return series
    .filter((r) => (kind === "cost" ? r[o.cost] !== null : r.emails >= facts.floors.minEmails))
    .map((r) => ({
      label: monthLabel(r.bucket),
      value: kind === "cost" ? r[o.cost] : r[o.rate],
      display: kind === "cost" ? usd(r[o.cost]) : rateText(o, r[o.rate]),
      note: counts(o, r),
      thin: kind === "cost" ? Boolean(r[o.costThin]) : r.emails < STRICT.minEmails,
    }));
}
const costTitle = (o) => `Cost per ${o.noun} (USD, lower is better)`;
const rateTitle = (o) => `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} ${o.rateUnit} (higher is better)`;

// A sentence on how the winner's curve moved, from its first to its last drawn month.
function movement(points) {
  if (points.length < 2) return null;
  const a = points[0], b = points[points.length - 1];
  return `${a.display} in ${a.label}, ${b.display} in ${b.label}`;
}

// ---------- studies ----------
const studies = [];
const add = (s) => studies.push(s);

function dimensionStudies(key, o, R, { dim, dimNoun, cutKey, byMonthKey, label }) {
  const rows = R[cutKey];
  // ROI
  {
    const w = costWinner(o, rows);
    const line = w ? monthLine(o, R[byMonthKey][w.row.bucket], "cost") : [];
    const moved = movement(line);
    add({
      id: `${o.crew}-${dim}-roi`,
      crew: o.crew,
      topic: dim,
      goal: "roi",
      question: `Which ${dimNoun} gets the cheapest ${o.noun}?`,
      status: w ? "measured" : "not_enough_data",
      headline: !w
        ? `No ${dimNoun} has produced a ${o.noun} yet.`
        : w.crowned
          ? `${label(w.row.bucket)} wins at ${usd(w.row[o.cost])} per ${o.noun}.`
          : `${label(w.row.bucket)} leads at ${usd(w.row[o.cost])} per ${o.noun}, on too few ${o.nounPlural} to call.`,
      winner: w ? label(w.row.bucket) : null,
      result: w ? { display: usd(w.row[o.cost]), unit: `per ${o.noun}`, sample: counts(o, w.row) } : null,
      crowned: w ? w.crowned : false,
      charts: [
        { kind: "bars", title: costTitle(o), lowerIsBetter: true, points: costBars(o, rows, label) },
        ...(w && line.length ? [{ kind: "line", title: `${label(w.row.bucket)}: cost per ${o.noun} by month`, lowerIsBetter: true, points: line }] : []),
      ],
      conclusion: [
        w ? `${label(w.row.bucket)}: ${counts(o, w.row)}, ${usd(w.row.spend)} spent.` : `Nothing priced yet.`,
        ...(moved ? [`Over time: ${moved}.`] : []),
        w && !w.crowned ? `We crown a winner past ${n(STRICT.minEmails)} ${o.emailsNoun} and ${o.strictOutcomes} ${o.nounPlural}; nothing clears that yet.` : null,
      ].filter(Boolean),
    });
  }
  // rate
  {
    const w = rateWinner(o, rows);
    const line = w ? monthLine(o, R[byMonthKey][w.row.bucket], "rate") : [];
    const moved = movement(line);
    add({
      id: `${o.crew}-${dim}-rate`,
      crew: o.crew,
      topic: dim,
      goal: "rate",
      question: `Which ${dimNoun} gets the most ${o.nounPlural}?`,
      status: w ? "measured" : "not_enough_data",
      headline: !w
        ? `No ${dimNoun} has sent ${n(STRICT.minEmails)} ${o.emailsNoun} yet.`
        : `${label(w.row.bucket)} leads with ${w.row[o.rate].toFixed(1)} ${o.nounPlural} ${o.rateUnit}.`,
      winner: w ? label(w.row.bucket) : null,
      result: w ? { display: w.row[o.rate].toFixed(1), unit: `${o.nounPlural} ${o.rateUnit}`, sample: counts(o, w.row) } : null,
      crowned: w ? w.crowned : false,
      charts: [
        { kind: "bars", title: rateTitle(o), lowerIsBetter: false, points: rateBars(o, rows, label) },
        ...(w && line.length ? [{ kind: "line", title: `${label(w.row.bucket)}: ${o.nounPlural} ${o.rateUnit} by month`, lowerIsBetter: false, points: line }] : []),
      ],
      conclusion: [
        w ? `${label(w.row.bucket)}: ${counts(o, w.row)}.` : null,
        ...(moved ? [`Over time: ${moved}.`] : []),
        `Only a ${dimNoun} past ${n(STRICT.minEmails)} ${o.emailsNoun} can lead; a smaller one is drawn and marked thin.`,
      ].filter(Boolean),
    });
  }
}

for (const key of ["reply", "visit"]) {
  const o = OUTCOMES[key];
  const R = facts.research[key];

  dimensionStudies(key, o, R, { dim: "llm", dimNoun: "LLM", cutKey: "byModel", byMonthKey: "modelByMonth", label: (b) => b });

  // cost over time: every email of the crew by month, then the cheapest LLM's own curve
  {
    const fleet = monthLine(o, R.byMonth.map((r) => r), "cost");
    const w = costWinner(o, R.byModel);
    const wl = w ? monthLine(o, R.modelByMonth[w.row.bucket], "cost") : [];
    const moved = movement(fleet);
    add({
      id: `${o.crew}-cost-over-time`,
      crew: o.crew,
      topic: "cost",
      goal: "roi",
      question: `What does a ${o.noun} cost, month by month?`,
      status: fleet.length ? "measured" : "not_enough_data",
      headline: moved ? `${moved.charAt(0).toUpperCase()}${moved.slice(1)} across all our emails.` : `Not enough ${o.nounPlural} to draw a curve yet.`,
      winner: w ? w.row.bucket : null,
      result: fleet.length ? { display: fleet[fleet.length - 1].display, unit: `per ${o.noun} in ${fleet[fleet.length - 1].label}`, sample: fleet[fleet.length - 1].note } : null,
      crowned: w ? w.crowned : false,
      charts: [
        { kind: "line", title: `All our emails: cost per ${o.noun} by month`, lowerIsBetter: true, points: fleet },
        ...(wl.length ? [{ kind: "line", title: `${w.row.bucket} (cheapest LLM): cost per ${o.noun} by month`, lowerIsBetter: true, points: wl }] : []),
      ],
      conclusion: [
        `The first curve mixes every workflow we ran that month; the second follows only the cheapest LLM.`,
        wl.length >= 2 ? `${w.row.bucket}: ${movement(wl)}.` : null,
      ].filter(Boolean),
    });
  }

  // follow-ups: stop after the first email, after follow-up 1, 2, 3
  {
    const steps = R.byStep;
    const first = steps.find((s) => s.bucket === "First email");
    let spend = 0, got = 0;
    const depth = steps.map((s, i) => {
      spend += s.spend; got += s[o.count];
      return { label: i === 0 ? "First email only" : `+ ${i} follow-up${i > 1 ? "s" : ""}`, spend, got, step: s };
    });
    const people = first ? first.emails : 0;
    const roiPts = depth.filter((d) => d.got > 0).map((d) => ({
      label: d.label,
      value: Number((d.spend / d.got).toFixed(2)),
      display: usd(d.spend / d.got),
      note: `${n(d.got)} ${d.got === 1 ? o.noun : o.nounPlural} · ${usd(d.spend)} spent`,
      thin: d.got < o.strictOutcomes,
    }));
    const per = key === "reply" ? 10000 : 1000;
    const ratePts = people ? depth.map((d) => ({
      label: d.label,
      value: Number(((d.got / people) * per).toFixed(1)),
      display: rateText(o, (d.got / people) * per),
      note: `${n(d.got)} ${d.got === 1 ? o.noun : o.nounPlural} from ${n(people)} people`,
      thin: people < STRICT.minEmails,
    })) : [];
    const stepCost = costBars(o, steps, (b) => b, { ordinal: true });
    const bestRoi = roiPts.length ? [...roiPts].sort((a, b) => a.value - b.value)[0] : null;
    const gains = ratePts.slice(1).map((p, i) => ({ label: p.label, gain: Number((p.value - ratePts[i].value).toFixed(1)) }));
    const lastUseful = [...gains].reverse().find((g) => g.gain > 0);
    add({
      id: `${o.crew}-followups-roi`,
      crew: o.crew,
      topic: "followups",
      goal: "roi",
      question: `How many follow-ups give the cheapest ${o.noun}?`,
      status: bestRoi ? "measured" : "not_enough_data",
      headline: bestRoi ? `${bestRoi.label}: ${bestRoi.display} per ${o.noun}, the cheapest depth.` : `No ${o.noun} yet at any depth.`,
      winner: bestRoi ? bestRoi.label : null,
      result: bestRoi ? { display: bestRoi.display, unit: `per ${o.noun}, ${bestRoi.label.toLowerCase()}`, sample: bestRoi.note } : null,
      crowned: bestRoi ? !bestRoi.thin : false,
      charts: [
        { kind: "bars", title: `Cost per ${o.noun} if the sequence stopped here (USD, lower is better)`, lowerIsBetter: true, points: roiPts },
        { kind: "bars", title: `Each email on its own: cost per ${o.noun} (USD, lower is better)`, lowerIsBetter: true, points: stepCost },
      ],
      conclusion: [
        `Each depth adds up the spend and the ${o.nounPlural} of every email up to it.`,
        `The second chart prices each email alone, which is what the next follow-up would cost.`,
      ],
    });
    add({
      id: `${o.crew}-followups-rate`,
      crew: o.crew,
      topic: "followups",
      goal: "rate",
      question: `How many follow-ups get the most ${o.nounPlural}?`,
      status: ratePts.length ? "measured" : "not_enough_data",
      headline: lastUseful
        ? `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} keep coming through ${lastUseful.label.replace("+ ", "")}: the last one adds ${lastUseful.gain} per ${per === 10000 ? "10,000" : "1,000"} people.`
        : ratePts.length ? `Follow-ups add no ${o.nounPlural} past the first email.` : `No sequences yet.`,
      winner: lastUseful ? lastUseful.label : ratePts[0]?.label ?? null,
      result: ratePts.length ? { display: ratePts[ratePts.length - 1].value.toFixed(1), unit: `${o.nounPlural} per ${per === 10000 ? "10,000" : "1,000"} people, all follow-ups`, sample: ratePts[ratePts.length - 1].note } : null,
      crowned: people >= STRICT.minEmails,
      charts: [
        { kind: "bars", title: `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} per ${per === 10000 ? "10,000" : "1,000"} people, adding each follow-up (higher is better)`, lowerIsBetter: false, points: ratePts },
      ],
      conclusion: [
        `Counted per person reached, so a follow-up is judged on what it adds, not on how many emails it took.`,
        ...gains.map((g) => `${g.label}: ${g.gain >= 0 ? "+" : ""}${g.gain} ${o.rateShort}.`),
      ],
    });
  }

  // open tracking: the pixel study (two periods, not a split test)
  {
    const metric = key === "reply" ? pixel.positive : pixel.clicked;
    const rateMetric = key === "reply" ? pixel.replied : pixel.clicked;
    const arm = (m, which) => ({
      label: which === "off" ? "Tracking off" : "Tracking on",
      value: m[which].pct,
      display: `${m[which].pct.toFixed(2)}%`,
      note: `${n(m[which].count)} of ${n(m[which].of)} people`,
      thin: false,
    });
    const verdict = (m, what) => {
      const off = m.off.pct, on = m.on.pct;
      const lead = off >= on ? "off" : "on";
      return m.significant
        ? `Tracking ${lead} wins: ${m[lead].pct.toFixed(2)}% of people ${what}, against ${m[lead === "off" ? "on" : "off"].pct.toFixed(2)}% (p ${m.p}).`
        : `No clear winner: ${off.toFixed(2)}% with tracking off, ${on.toFixed(2)}% with it on (p ${m.p}, not significant).`;
    };
    // The result cell states both arms: the page compares them, it does not pick one quietly.
    const armResult = (m) => ({ display: `${m.off.pct.toFixed(2)}%`, unit: `with tracking off, ${m.on.pct.toFixed(2)}% on`, sample: `p ${m.p}, ${n(m.off.of + m.on.of)} people` });
    const periods = `Tracking was on from ${pixel.on.firstDay} to ${pixel.on.lastDay} and off until ${pixel.off.lastDay}: two periods, not a split test, over ${n(pixel.total.leads)} people.`;
    const what = key === "reply" ? "replied positively" : "visited the website";
    add({
      id: `${o.crew}-opens-roi`,
      crew: o.crew,
      topic: "opens",
      goal: "roi",
      question: `Should we track opens for the cheapest ${o.noun}?`,
      status: "measured",
      headline: verdict(metric, what),
      winner: metric.significant ? (metric.off.pct >= metric.on.pct ? "Tracking off" : "Tracking on") : null,
      result: armResult(metric),
      crowned: metric.significant,
      charts: [{ kind: "bars", title: `People who ${what} (%, higher is better)`, lowerIsBetter: false, points: [arm(metric, "off"), arm(metric, "on")] }],
      conclusion: [
        `An email costs the same with or without the pixel, so the cheaper ${o.noun} is the arm with more of them per person.`,
        periods,
      ],
    });
    add({
      id: `${o.crew}-opens-rate`,
      crew: o.crew,
      topic: "opens",
      goal: "rate",
      question: key === "reply" ? `Should we track opens for the best reply rate?` : `Should we track opens for the most website visits?`,
      status: "measured",
      headline: verdict(rateMetric, key === "reply" ? "replied" : "visited the website"),
      winner: rateMetric.significant ? (rateMetric.off.pct >= rateMetric.on.pct ? "Tracking off" : "Tracking on") : null,
      result: armResult(rateMetric),
      crowned: rateMetric.significant,
      charts: [
        { kind: "bars", title: key === "reply" ? `People who replied, any reply (%, higher is better)` : `People who visited the website (%, higher is better)`, lowerIsBetter: false, points: [arm(rateMetric, "off"), arm(rateMetric, "on")] },
        ...(key === "reply" ? [{ kind: "bars", title: `Bounced (%, lower is better)`, lowerIsBetter: true, points: [arm(pixel.bounced, "off"), arm(pixel.bounced, "on")] }] : []),
      ],
      conclusion: [
        key === "reply" ? `Auto-replies and out-of-office messages are not counted as replies.` : `A visit is the first tracked click a person made.`,
        periods,
      ],
    });
  }

  dimensionStudies(key, o, R, { dim: "template", dimNoun: "template", cutKey: "byTemplate", byMonthKey: "templateByMonth", label: templateLabel });
}

// Pilot runs on one workflow (one model, one template) since early September: every comparison
// needs at least two, so its cards state that rather than show a single bar as a result.
const PILOT_REASON = "Pilot has run one workflow (one LLM, one template) on 3 campaigns since 2 Sep 2026. A comparison needs at least two.";
for (const [topic, question] of [
  ["llm", "Which LLM books the most meetings from a positive reply?"],
  ["template", "Which template books the most meetings from a positive reply?"],
  ["followups", "How many follow-ups after a positive reply book the most meetings?"],
  ["cost", "What does a booked meeting cost, month by month?"],
]) {
  add({ id: `pilot-${topic}`, crew: "pilot", topic, goal: topic === "cost" ? "roi" : "rate", question, status: "not_enough_data", headline: "Not enough data yet.", winner: null, crowned: false, result: null, charts: [], conclusion: [PILOT_REASON] });
}

const out = {
  generatedAt: facts.generatedAt,
  allOrgs: true,
  window: { from: facts.research.window.from, to: facts.research.window.to },
  readOn: facts.generatedAt.slice(0, 10),
  volume: {
    emails: facts.volume.emails,
    orgs: facts.volume.orgs,
    workflows: facts.volume.workflows,
    linkedEmails: facts.volume.linked.emails,
    // emails sent per month, for the stat tile's small bars
    byMonth: facts.research.reply.byMonth.map((r) => ({ label: monthLabel(r.bucket), emails: r.emails })),
  },
  floors: { minEmails: facts.floors.minEmails, crown: STRICT },
  crews: [
    { id: "herald", outcome: "Positive reply", description: "Cold email that gets a prospect to answer with interest." },
    { id: "scout", outcome: "Website visit", description: "Cold email that brings a prospect to the website." },
    { id: "pilot", outcome: "Meeting booked", description: "Turns a positive reply into a booked meeting." },
  ],
  studies,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
