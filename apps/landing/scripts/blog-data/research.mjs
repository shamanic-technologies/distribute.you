#!/usr/bin/env node
// Writes the dataset the staff Research page (dashboard v2) renders, from the SAME fact table the
// data articles are derived from, so a study and an article can never state two figures for one
// population. Every study is fleet-wide (all orgs). The page divides nothing: every value, every
// label and every sentence it shows is written here.
//
//   node research.mjs /tmp/research-data/facts.json apps/dashboard/src/lib/research \
//     > apps/dashboard/src/lib/research/research.json
//
// The second argument is the directory that receives the two side files the workflow and
// template pages read: research-catalog.json (one entry per workflow and per template, per crew)
// and research-templates.json (the text of every listed template). They stay out of
// research.json so the hub does not carry them; the page loads them right after it paints.
//
// Definitions (stated on the page under "How we measured"):
//  - ROI is read as COST PER OUTCOME: every crew buys one outcome, so the cheaper outcome is the
//    better return. Herald's outcome is a positive reply, Scout's a website visit (priced on the
//    emails that carried a link, since a visit cannot come from an email without one).
//  - A RATE is a PERCENT, two decimals (0.18%): of emails for positive replies (Herald), of
//    link-carrying emails for website visits (Scout). Owner rule (2026-09-27): never "N per 10,000".
//  - The WINNER is always the top bar: the cheapest price, or the highest rate. Owner rule
//    (2026-09-27): a thin bar is ranked where its value puts it, never sunk below the rest, and if
//    it comes first it wins. `crowned` only says whether the winner also clears the strict floors
//    the articles use for their best workflow; when it does not, the page says its counts are thin.
//  - Every outcome figure leaves out the emails too young to have earned their outcome: the
//    MATURATION window, measured in derive.mjs from our own send-to-outcome latencies. Every chart
//    carries a `note` saying so, in the words a reader sees under it.
//  - A WORKFLOW is named by what it runs (its model and its template, and the month it first sent
//    when two share both), never by its codename: nobody outside the team knows the names.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MODEL_LABEL } from "./model-label.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: research.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
if (!facts.research) throw new Error("facts.json carries no research block: re-run derive.mjs");
const pixel = JSON.parse(
  execFileSync("node", [join(here, "pixel/derive-pixel.mjs"), join(here, "pixel/pixel.snapshot.json")], { encoding: "utf8" }),
);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STRICT = facts.floors.bestWorkflow;
const M = facts.maturation;
if (!M || !Number.isInteger(M.days) || !M.note) throw new Error("facts.json carries no maturation window: re-run derive.mjs");
// The open-tracking study is read from its own snapshot, with its own cutoff before the read.
const pixelHeldDays = Math.round((Date.parse(`${pixel.readAt}T00:00:00Z`) - Date.parse(`${pixel.cutoff}T00:00:00Z`)) / 86_400_000);
if (pixelHeldDays < M.days) throw new Error(`the open-tracking snapshot leaves ${pixelHeldDays} days, under the ${M.days}-day maturation window: re-extract it`);
const PIXEL_NOTE = `Emails sent in the ${pixelHeldDays} days before the read are left out (from ${MONTHS[Number(pixel.cutoff.slice(5, 7)) - 1]} ${Number(pixel.cutoff.slice(8, 10))} on), more than the ${M.days} days 95 in 100 replies and clicks need to arrive.`;
const n = (v) => Number(v).toLocaleString("en-US");
const usd = (v) => (Math.abs(v) < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
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

// A workflow reads as what it runs. Two workflows can run the same model and template (a new
// version of the workflow keeps both), so the month it first sent tells them apart, and a number
// only when that is shared too. Built once over every workflow, so a label is the same in both crews.
const WORKFLOW_LABEL = (() => {
  const meta = facts.research.workflowMeta;
  const firstMonth = {};
  for (const key of ["reply", "visit"]) {
    for (const [wf, rows] of Object.entries(facts.research[key].workflowByMonth)) {
      const m = rows[0]?.bucket;
      if (m && (!firstMonth[wf] || m < firstMonth[wf])) firstMonth[wf] = m;
    }
  }
  const base = (wf) => {
    const x = meta[wf] || {};
    return `${x.model || "Model not recorded"} · ${x.template ? templateLabel(x.template) : "template not recorded"}`;
  };
  const groups = new Map();
  for (const wf of Object.keys(meta)) {
    const b = base(wf);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(wf);
  }
  const out = {};
  for (const [b, wfs] of groups) {
    if (wfs.length === 1) { out[wfs[0]] = b; continue; }
    const byMonth = new Map();
    for (const wf of wfs) {
      const m = firstMonth[wf] ? monthLabel(firstMonth[wf]) : "undated";
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(wf);
    }
    for (const [m, same] of byMonth) {
      same.sort();
      same.forEach((wf, i) => { out[wf] = `${b} (from ${m}${same.length > 1 ? `, #${i + 1}` : ""})`; });
    }
  }
  return out;
})();
const workflowLabel = (wf) => {
  const l = WORKFLOW_LABEL[wf];
  if (!l) throw new Error(`no label for a workflow in the research block`);
  return l;
};

// A bar's key names the page it opens. A model's bucket is its label ("Gemini 3.1 Pro"), so its
// key is a slug; a workflow's (dynasty slug) and a template's (template id) are already ids.
const modelKey = (label) => label.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
const MODEL_LABELS = new Set(Object.values(MODEL_LABEL));
const keyOf = (bucket) => (MODEL_LABELS.has(bucket) ? modelKey(bucket) : bucket);

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
    per: 10000,
    pct: true,
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
    per: 1000,
    pct: true,
    strictOutcomes: STRICT.minClicks,
    emailsNoun: "emails with a link",
  },
};

const counts = (o, row) => `${n(row[o.count])} ${row[o.count] === 1 ? o.noun : o.nounPlural} · ${n(row.emails)} ${o.emailsNoun}`;
// Rates read as a percent, two decimals. v is per `o.per` emails, so divide by per/100.
const pctOf = (o, v) => v / (o.per / 100);
const rateText = (o, v) => (o.pct ? `${pctOf(o, v).toFixed(2)}%` : `${v.toFixed(1)} ${o.rateShort}`);
const rateLabel = (o) => (o.pct ? `${o.noun} rate` : `${o.nounPlural} ${o.rateUnit}`);
const rateSentence = (o, v) => (o.pct ? `a ${rateText(o, v)} ${o.noun} rate` : `${v.toFixed(1)} ${o.nounPlural} ${o.rateUnit}`);

// A bar is THIN below the strict floors: drawn at its rank, marked, and weighed with its counts.
const costThinStrict = (o, r) => r.emails < STRICT.minEmails || r[o.count] < o.strictOutcomes;
// Costs: cheapest first, thin or not; a row with no outcome has no price.
const byCost = (o) => (a, b) => a[o.cost] - b[o.cost] || b[o.count] - a[o.count];
function costBars(o, rows, label = (b) => b, { ordinal = false, keyed = false } = {}) {
  const priced = rows.filter((r) => r[o.cost] !== null);
  const ordered = ordinal ? priced : [...priced].sort(byCost(o));
  return ordered.map((r) => ({
    ...(keyed ? { key: keyOf(r.bucket) } : {}),
    label: label(r.bucket),
    value: r[o.cost],
    display: usd(r[o.cost]),
    note: counts(o, r),
    thin: costThinStrict(o, r),
  }));
}
// Rates: a zero is a measured zero and is drawn; a bucket under the email floor is thin.
function rateBars(o, rows, label = (b) => b, { ordinal = false, keyed = false } = {}) {
  const drawn = rows.filter((r) => r.emails >= facts.floors.minEmails);
  const ordered = ordinal ? drawn : [...drawn].sort((a, b) => b[o.rate] - a[o.rate] || b.emails - a.emails);
  return ordered.map((r) => ({
    ...(keyed ? { key: keyOf(r.bucket) } : {}),
    label: label(r.bucket),
    value: r[o.rate],
    display: rateText(o, r[o.rate]),
    note: counts(o, r),
    thin: r.emails < STRICT.minEmails || r[o.count] < o.strictOutcomes,
  }));
}

// The winner is the first bar of the chart, thin or not: the cheapest price on cost, the highest
// rate on rate. `crowned` says whether it also clears the strict floors.
function costWinner(o, rows) {
  const priced = rows.filter((r) => r[o.cost] !== null);
  if (!priced.length) return null;
  const row = [...priced].sort(byCost(o))[0];
  return { row, crowned: !costThinStrict(o, row) };
}
function rateWinner(o, rows) {
  const drawn = rows.filter((r) => r.emails >= facts.floors.minEmails && r[o.count] > 0);
  if (!drawn.length) return null;
  const row = [...drawn].sort((a, b) => b[o.rate] - a[o.rate] || b.emails - a.emails)[0];
  return { row, crowned: row.emails >= STRICT.minEmails && row[o.count] >= o.strictOutcomes };
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
// The average SINCE INCEPTION at the end of each month: everything spent (or sent) up to that
// month over every outcome up to it. A month with no outcome still carries its spend, so the
// average climbs through a dry spell instead of skipping it. Written here, never in the browser.
function sinceInception(o, series, kind) {
  if (!series) return [];
  let spend = 0, got = 0, emails = 0;
  const out = [];
  for (const r of series) {
    spend += r.spend; got += r[o.count]; emails += r.emails;
    if (kind === "cost" ? got === 0 : emails < facts.floors.minEmails) continue;
    const value = kind === "cost" ? spend / got : (got / emails) * o.per;
    out.push({
      label: monthLabel(r.bucket),
      value: Number(value.toFixed(2)),
      display: kind === "cost" ? usd(value) : rateText(o, value),
      note: `${n(got)} ${got === 1 ? o.noun : o.nounPlural} · ${n(emails)} ${o.emailsNoun} to date`,
      thin: kind === "cost" ? got < o.strictOutcomes : emails < STRICT.minEmails,
    });
  }
  return out;
}
// One monthly chart: the month on its own as bars, the average since inception beside it.
function monthsChart(o, series, kind, subject, lowerIsBetter) {
  const what = kind === "cost" ? `cost per ${o.noun}` : rateLabel(o);
  return {
    kind: "months",
    title: `${subject}: ${what} by month`,
    lowerIsBetter,
    points: monthLine(o, series, kind),
    cumulative: { title: `${subject}: average since inception`, points: sinceInception(o, series, kind) },
    note: M.note,
  };
}
const costTitle = (o) => `Cost per ${o.noun} (USD, lower is better)`;
const rateTitle = (o) => (o.pct ? `${o.noun.charAt(0).toUpperCase()}${o.noun.slice(1)} rate, % of ${o.emailsNoun} (higher is better)` : `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} ${o.rateUnit} (higher is better)`);

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
  // A workflow's or a template's bar carries its key, so the page can open that one's own page.
  const keyed = dim === "workflow" || dim === "template" || dim === "llm";
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
        : `${label(w.row.bucket)} wins at ${usd(w.row[o.cost])} per ${o.noun}.`,
      winner: w ? label(w.row.bucket) : null,
      result: w ? { display: usd(w.row[o.cost]), unit: `per ${o.noun}`, sample: counts(o, w.row) } : null,
      crowned: w ? w.crowned : false,
      charts: [
        { kind: "bars", title: costTitle(o), lowerIsBetter: true, points: costBars(o, rows, label, { keyed }), note: M.note },
        ...(w && line.length ? [monthsChart(o, R[byMonthKey][w.row.bucket], "cost", label(w.row.bucket), true)] : []),
      ],
      conclusion: [
        w ? `${label(w.row.bucket)}: ${counts(o, w.row)}, ${usd(w.row.spend)} spent.` : `Nothing priced yet.`,
        ...(moved ? [`Over time: ${moved}.`] : []),
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
        ? `No ${dimNoun} has earned a ${o.noun} yet.`
        : `${label(w.row.bucket)} wins with ${rateSentence(o, w.row[o.rate])}.`,
      winner: w ? label(w.row.bucket) : null,
      result: w ? { display: o.pct ? rateText(o, w.row[o.rate]) : w.row[o.rate].toFixed(1), unit: rateLabel(o), sample: counts(o, w.row) } : null,
      crowned: w ? w.crowned : false,
      charts: [
        { kind: "bars", title: rateTitle(o), lowerIsBetter: false, points: rateBars(o, rows, label, { keyed }), note: M.note },
        ...(w && line.length ? [monthsChart(o, R[byMonthKey][w.row.bucket], "rate", label(w.row.bucket), false)] : []),
      ],
      conclusion: [
        w ? `${label(w.row.bucket)}: ${counts(o, w.row)}.` : null,
        ...(moved ? [`Over time: ${moved}.`] : []),
        `A ${dimNoun} under ${n(STRICT.minEmails)} ${o.emailsNoun} or ${o.strictOutcomes} ${o.nounPlural} is ranked where its rate puts it and marked thin.`,
      ].filter(Boolean),
    });
  }
}

for (const key of ["reply", "visit"]) {
  const o = OUTCOMES[key];
  const R = facts.research[key];

  dimensionStudies(key, o, R, { dim: "llm", dimNoun: "LLM", cutKey: "byModel", byMonthKey: "modelByMonth", label: (b) => b });

  // cost: the AVERAGE since inception (everything spent over every outcome, all months pooled),
  // never the last month on its own. The monthly bars stay beside it as context.
  {
    const avg = sinceInception(o, R.byMonth, "cost");
    const w = costWinner(o, R.byModel);
    const wavg = w ? sinceInception(o, R.modelByMonth[w.row.bucket], "cost") : [];
    const all = avg.length ? avg[avg.length - 1] : null;
    const best = wavg.length ? wavg[wavg.length - 1] : null;
    add({
      id: `${o.crew}-cost-over-time`,
      crew: o.crew,
      topic: "cost",
      goal: "roi",
      question: `What does a ${o.noun} cost on average?`,
      status: all ? "measured" : "not_enough_data",
      headline: all ? `${all.display} per ${o.noun} on average since inception, across all our emails.` : `Not enough ${o.nounPlural} to state an average yet.`,
      winner: w ? w.row.bucket : null,
      result: all ? { display: all.display, unit: `per ${o.noun}, average since inception`, sample: all.note } : null,
      crowned: w ? w.crowned : false,
      charts: [
        monthsChart(o, R.byMonth, "cost", "All our emails", true),
        ...(wavg.length ? [monthsChart(o, R.modelByMonth[w.row.bucket], "cost", `${w.row.bucket} (cheapest LLM)`, true)] : []),
      ],
      conclusion: [
        `The average divides everything spent since the first email by every ${o.noun} since; the monthly bars are context, not the answer.`,
        best ? `${w.row.bucket} (cheapest LLM): ${best.display} per ${o.noun} on average since inception.` : null,
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
        { kind: "bars", title: `Cost per ${o.noun} if the sequence stopped here (USD, lower is better)`, lowerIsBetter: true, points: roiPts, note: M.note },
        { kind: "bars", title: `Each email on its own: cost per ${o.noun} (USD, lower is better)`, lowerIsBetter: true, points: stepCost, note: M.note },
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
        ? `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} keep coming through ${lastUseful.label.replace("+ ", "")}: the last one adds ${o.pct ? `${pctOf(o, lastUseful.gain).toFixed(2)} points` : `${lastUseful.gain} per 1,000 people`}.`
        : ratePts.length ? `Follow-ups add no ${o.nounPlural} past the first email.` : `No sequences yet.`,
      winner: lastUseful ? lastUseful.label : ratePts[0]?.label ?? null,
      result: ratePts.length ? { display: o.pct ? ratePts[ratePts.length - 1].display : ratePts[ratePts.length - 1].value.toFixed(1), unit: o.pct ? `of people got a ${o.noun}, all follow-ups` : `${o.nounPlural} per 1,000 people, all follow-ups`, sample: ratePts[ratePts.length - 1].note } : null,
      crowned: people >= STRICT.minEmails,
      charts: [
        { kind: "bars", title: o.pct ? `${o.noun.charAt(0).toUpperCase()}${o.noun.slice(1)} rate, % of people, adding each follow-up (higher is better)` : `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} per 1,000 people, adding each follow-up (higher is better)`, lowerIsBetter: false, points: ratePts, note: M.note },
      ],
      conclusion: [
        `Counted per person reached, so a follow-up is judged on what it adds, not on how many emails it took.`,
        ...gains.map((g) => `${g.label}: ${g.gain >= 0 ? "+" : ""}${o.pct ? `${pctOf(o, g.gain).toFixed(2)} points` : `${g.gain} ${o.rateShort}`}.`),
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
      charts: [{ kind: "bars", title: `People who ${what} (%, higher is better)`, lowerIsBetter: false, points: [arm(metric, "off"), arm(metric, "on")], note: PIXEL_NOTE }],
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
        { kind: "bars", title: key === "reply" ? `People who replied, any reply (%, higher is better)` : `People who visited the website (%, higher is better)`, lowerIsBetter: false, points: [arm(rateMetric, "off"), arm(rateMetric, "on")], note: PIXEL_NOTE },
        ...(key === "reply" ? [{ kind: "bars", title: `Bounced (%, lower is better)`, lowerIsBetter: true, points: [arm(pixel.bounced, "off"), arm(pixel.bounced, "on")], note: PIXEL_NOTE }] : []),
      ],
      conclusion: [
        key === "reply" ? `Auto-replies and out-of-office messages are not counted as replies.` : `A visit is the first tracked click a person made.`,
        periods,
      ],
    });
  }

  dimensionStudies(key, o, R, { dim: "template", dimNoun: "template", cutKey: "byTemplate", byMonthKey: "templateByMonth", label: templateLabel });

  // The best workflow: one model and one template together, which is what a campaign actually
  // runs. The same floors crown it as every other study.
  dimensionStudies(key, o, R, { dim: "workflow", dimNoun: "workflow", cutKey: "byWorkflow", byMonthKey: "workflowByMonth", label: workflowLabel });
}

// Pilot runs on one workflow (one model, one template) since early September: every comparison
// needs at least two, so its cards state that rather than show a single bar as a result.
const PILOT_REASON = "Pilot has run one workflow (one LLM, one template) on 3 campaigns since 2 Sep 2026. A comparison needs at least two.";
for (const [topic, question] of [
  ["llm", "Which LLM books the most meetings from a positive reply?"],
  ["template", "Which template books the most meetings from a positive reply?"],
  ["followups", "How many follow-ups after a positive reply book the most meetings?"],
  ["cost", "What does a booked meeting cost on average?"],
]) {
  add({ id: `pilot-${topic}`, crew: "pilot", topic, goal: topic === "cost" ? "roi" : "rate", question, status: "not_enough_data", headline: "Not enough data yet.", winner: null, crowned: false, result: null, charts: [], conclusion: [PILOT_REASON] });
}
for (const [goal, question] of [
  ["roi", "Which workflow books a meeting for the least?"],
  ["rate", "Which workflow books the most meetings from a positive reply?"],
]) {
  add({ id: `pilot-workflow-${goal}`, crew: "pilot", topic: "workflow", goal, question, status: "not_enough_data", headline: "Not enough data yet.", winner: null, crowned: false, result: null, charts: [], conclusion: [PILOT_REASON] });
}

// ---------- catalogue: one page per workflow and per template, per crew ----------
// Read beside facts.json (extract.sh writes them into the same directory). Every row here is
// fleet-wide and names no client and no lead.
const dataDir = dirname(factsPath);
const readJson = (f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"));
const templateTexts = new Map(readJson("templates.json").map((t) => [t.type, t.prompt]));
const workflowRuns = readJson("workflow-runs.json");
const templateRuns = readJson("template-runs.json");
const modelRuns = readJson("model-runs.json");
// A workflow VERSION to the workflow (dynasty) it belongs to, as workflow-service records it.
// And each workflow's NAME (Maelstrom, Lithium, ...) as workflow-service states it, verbatim.
const dynastyOf = new Map();
const nameOf = new Map();
for (const line of readFileSync(join(dataDir, "workflows.csv"), "utf8").trim().split("\n").slice(1)) {
  const [slug, dynasty, name] = line.split(",");
  dynastyOf.set(slug, dynasty || slug);
  if (name && !nameOf.has(dynasty || slug)) nameOf.set(dynasty || slug, name);
}
const versionText = (slug) => `v${/-v(\d+)$/.exec(slug)?.[1] ?? "1"}`;
const pad = (x) => String(x).padStart(2, "0");
// "Sep 26, 05:51 UTC": the page prints this as written.
function whenText(iso) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
function durationText(a, b) {
  if (!a || !b) return null;
  const s = Math.round((Date.parse(b) - Date.parse(a)) / 1000);
  return s < 120 ? `${s}s` : `${Math.round(s / 60)} min`;
}
const RUNS_SHOWN = 10;

// Cheapest first (the study's own ROI order), then the unpriced ones by volume.
function catalogOrder(o, rows) {
  const priced = rows.filter((r) => r[o.cost] !== null).sort(byCost(o));
  const rest = rows.filter((r) => r[o.cost] === null && r.emails >= facts.floors.minEmails).sort((a, b) => b.emails - a.emails);
  return [...priced, ...rest];
}
function figures(o, r) {
  return {
    emails: n(r.emails),
    emailsNoun: o.emailsNoun,
    outcomes: n(r[o.count]),
    spend: usd(r.spend),
    cost: r[o.cost] === null ? null : usd(r[o.cost]),
    rate: r.emails >= facts.floors.minEmails ? rateText(o, r[o.rate]) : null,
    thin: costThinStrict(o, r),
    sample: counts(o, r),
  };
}
function curves(o, series, subject) {
  const out = [];
  if (monthLine(o, series, "cost").length) out.push(monthsChart(o, series, "cost", subject, true));
  if (monthLine(o, series, "rate").length) out.push(monthsChart(o, series, "rate", subject, false));
  return out;
}

const catalog = {};
const textsListed = new Set();
for (const key of ["reply", "visit"]) {
  const o = OUTCOMES[key];
  const R = facts.research[key];
  const meta = facts.research.workflowMeta;
  const tplRows = catalogOrder(o, R.byTemplate);
  const tplKeys = new Set(tplRows.map((r) => r.bucket));
  const wfRows = catalogOrder(o, R.byWorkflow);
  const wfKeys = new Set(wfRows.map((r) => r.bucket));
  const mdRows = catalogOrder(o, R.byModel);
  const modelLabels = new Set(mdRows.map((r) => r.bucket));
  const modelRef = (raw) => {
    const label = raw ? MODEL_LABEL[raw] || raw : null;
    return label ? { key: modelKey(label), label, linked: modelLabels.has(label) } : null;
  };
  const workflows = wfRows.map((r, i) => {
    const m = meta[r.bucket] || {};
    return {
      key: r.bucket,
      label: workflowLabel(r.bucket),
      name: nameOf.get(r.bucket) ?? null,
      rank: r[o.cost] === null ? null : i + 1,
      model: m.model ? { key: modelKey(m.model), label: m.model, linked: modelLabels.has(m.model) } : null,
      template: m.template ? { key: m.template, label: templateLabel(m.template), linked: tplKeys.has(m.template) } : null,
      ...figures(o, r),
      charts: curves(o, R.workflowByMonth[r.bucket], workflowLabel(r.bucket)),
      runs: workflowRuns
        .filter((x) => (dynastyOf.get(x.workflowSlug) ?? x.workflowSlug) === r.bucket)
        .slice(0, RUNS_SHOWN)
        .map((x) => ({
          when: whenText(x.startedAt),
          version: versionText(x.workflowSlug),
          status: x.status,
          duration: durationText(x.startedAt, x.completedAt),
          // A run whose every cost was cancelled was not charged: null, never "$0.00".
          cost: Number(x.cents) > 0 ? usd(Number(x.cents) / 100) : null,
        })),
    };
  });
  const templates = tplRows.map((r, i) => {
    textsListed.add(r.bucket);
    return {
      key: r.bucket,
      label: templateLabel(r.bucket),
      rank: r[o.cost] === null ? null : i + 1,
      hasText: templateTexts.has(r.bucket),
      ...figures(o, r),
      charts: curves(o, R.templateByMonth[r.bucket], templateLabel(r.bucket)),
      workflows: workflows.filter((w) => w.template?.key === r.bucket).map((w) => ({ key: w.key, label: w.label })),
      runs: templateRuns
        .filter((x) => x.template === r.bucket)
        .slice(0, RUNS_SHOWN)
        .map((x) => {
          const dynasty = x.workflowSlug ? (dynastyOf.get(x.workflowSlug) ?? x.workflowSlug) : null;
          return {
            when: whenText(x.createdAt),
            model: modelRef(x.model),
            workflow: dynasty && wfKeys.has(dynasty) ? { key: dynasty, label: workflowLabel(dynasty) } : null,
            version: x.workflowSlug ? versionText(x.workflowSlug) : null,
            tokens: x.tokensIn == null ? null : `${n(x.tokensIn)} in · ${n(x.tokensOut ?? 0)} out`,
          };
        }),
    };
  });
  const models = mdRows.map((r, i) => ({
    key: modelKey(r.bucket),
    label: r.bucket,
    rank: r[o.cost] === null ? null : i + 1,
    ...figures(o, r),
    charts: curves(o, R.modelByMonth[r.bucket], r.bucket),
    workflows: workflows.filter((w) => w.model?.label === r.bucket).map((w) => ({ key: w.key, label: w.label })),
    // Two ids can name one model (a deprecated alias beside its successor): merged, newest first.
    runs: modelRuns
      .filter((x) => (MODEL_LABEL[x.model] || x.model) === r.bucket)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, RUNS_SHOWN)
      .map((x) => {
        const dynasty = x.workflowSlug ? (dynastyOf.get(x.workflowSlug) ?? x.workflowSlug) : null;
        return {
          when: whenText(x.createdAt),
          workflow: dynasty && wfKeys.has(dynasty) ? { key: dynasty, label: workflowLabel(dynasty) } : null,
          template: x.template ? { key: x.template, label: templateLabel(x.template), linked: tplKeys.has(x.template) } : null,
          version: x.workflowSlug ? versionText(x.workflowSlug) : null,
          tokens: x.tokensIn == null ? null : `${n(x.tokensIn)} in · ${n(x.tokensOut ?? 0)} out`,
        };
      }),
  }));
  catalog[o.crew] = { workflows, templates, models };
}
catalog.pilot = { workflows: [], templates: [], models: [] };

const sideDir = process.argv[3];
if (!sideDir) throw new Error("usage: research.mjs <facts.json> <dir for research-catalog.json + research-templates.json>");
{
  const texts = {};
  for (const k of [...textsListed].sort()) if (templateTexts.has(k)) texts[k] = templateTexts.get(k);
  writeFileSync(join(sideDir, "research-catalog.json"), `${JSON.stringify(catalog)}\n`);
  writeFileSync(join(sideDir, "research-templates.json"), `${JSON.stringify(texts)}\n`);
}
// What the hub prints beside each crew: how many workflows and templates its pages list.
const catalogCounts = Object.fromEntries(
  Object.entries(catalog).map(([crew, c]) => [crew, { workflows: c.workflows.length, templates: c.templates.length, models: c.models.length }]),
);

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
  // Measured in derive.mjs: how long after the email that earned it a reply or a click arrives.
  maturation: {
    days: M.days,
    percentile: M.percentile,
    cutoff: M.cutoff,
    windowEnd: M.windowEnd,
    reply: M.reply,
    click: M.click,
    excludedEmails: M.excludedEmails,
    note: M.note,
  },
  crews: [
    { id: "herald", outcome: "Positive reply", description: "Cold email that gets a prospect to answer with interest." },
    { id: "scout", outcome: "Website visit", description: "Cold email that brings a prospect to the website." },
    { id: "pilot", outcome: "Meeting booked", description: "Turns a positive reply into a booked meeting." },
  ],
  studies,
  catalogCounts,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
