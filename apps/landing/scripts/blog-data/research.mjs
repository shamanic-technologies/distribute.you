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
//    (2026-09-27): a Learning bar is ranked where its value puts it, never sunk below the rest,
//    and if it comes first it wins. `crowned` only says whether the winner rests on enough
//    outcomes to be more than Learning.
//  - Every figure is on features-service's MATURITY RULE (features-service#1196), the one every
//    price in the dashboard is on, read per leg off its channel catalogue and never measured here:
//    only the leads whose serving run STARTED at least the leg's duration before the read count,
//    with every outcome they produced since; a figure resting on fewer outcomes than the leg
//    requires is marked Learning (the `thin` flag). Every chart carries a `note` saying so.
//  - A WORKFLOW is named by what it runs (its model and its template, and the month it first sent
//    when two share both), never by its codename: nobody outside the team knows the names.
import { likeForLike, sharedPairs } from "./like-for-like.mjs";
import { compareVerdict, headlineFor, MIN_OUTCOMES } from "./verdict.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MODEL_LABEL } from "./model-label.mjs";
import { meetingStudies } from "./meetings.mjs";
import { NAMING_LABEL, namingOf, namingSides, rateP, costP, pText } from "./naming/naming.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: research.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
if (!facts.research) throw new Error("facts.json carries no research block: re-run derive.mjs");
// The open-tracking studies read their OWN snapshot, cut at the research rule's duration.
const pixel = JSON.parse(
  execFileSync("node", [join(here, "pixel/derive-pixel.mjs"), join(here, "pixel/pixel.research.snapshot.json")], { encoding: "utf8" }),
);

// extract.sh writes every input beside facts.json: the template texts are read up here since
// a study (naming the client) classifies templates by what their prompt tells the model to do.
const dataDir = dirname(factsPath);
const readJson = (f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"));
const templateTexts = new Map(readJson("templates.json").map((t) => [t.type, t.prompt]));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// THE RULE, features-service's per leg (derive.mjs applies it; this states it).
const M = facts.researchMaturity;
if (!M || !M.legs?.reply || !M.legs?.visit) throw new Error("facts.json carries no researchMaturity: re-run derive.mjs");
for (const l of [M.legs.reply, M.legs.visit]) {
  if (!Number.isInteger(l.durationDays) || !Number.isInteger(l.outcomesRequired) || !/^\d{4}-\d{2}-\d{2}$/.test(l.cutoff || "")) {
    throw new Error(`researchMaturity carries no usable rule for ${l.legKey}: re-run derive.mjs`);
  }
}
const cutoffText = (ymd) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
const sameRule = M.legs.reply.durationDays === M.legs.visit.durationDays && M.legs.reply.cutoff === M.legs.visit.cutoff;
const RULE_DAYS = Math.max(M.legs.reply.durationDays, M.legs.visit.durationDays);
const ruleWhen = sameRule
  ? `at least ${M.legs.reply.durationDays} days before the read (before ${cutoffText(M.legs.reply.cutoff)})`
  : `at least ${M.legs.reply.durationDays} days (positive replies) or ${M.legs.visit.durationDays} days (website visits) before the read`;
const RULE_NOTE = `Only people we started writing to ${ruleWhen} count, with every positive reply and website visit they sent since. A figure needs ${M.legs.reply.outcomesRequired} positive ${M.legs.reply.outcomesRequired === 1 ? "reply" : "replies"} (${M.legs.visit.outcomesRequired} website ${M.legs.visit.outcomesRequired === 1 ? "visit" : "visits"}) behind it; below that it reads Learning. A website visit is a click our link-scanner check judged human, which only the emails we send ourselves can carry: website-visit figures leave out the emails sent through the provider, whose clicks are mostly scanners and cannot be screened.`;
// The open-tracking study is read from its own snapshot, with its own cutoff before the read.
const pixelHeldDays = Math.round((Date.parse(`${pixel.readAt.slice(0, 10)}T00:00:00Z`) - Date.parse(`${pixel.cutoff}T00:00:00Z`)) / 86_400_000);
if (pixelHeldDays < RULE_DAYS) throw new Error(`the open-tracking research snapshot leaves ${pixelHeldDays} days, under the ${RULE_DAYS}-day rule: re-extract pixel.research.snapshot.json`);
const PIXEL_NOTE = `People we started writing to in the ${pixelHeldDays} days before the read are left out (from ${cutoffText(pixel.cutoff)} on), at least the ${RULE_DAYS} days every price here waits for replies and visits to arrive.`;
const n = (v) => Number(v).toLocaleString("en-US");
const usd = (v) => (Math.abs(v) < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
// The window sits inside one year, so a month reads alone; a second year would need it stated.
// Exact 95% Poisson interval on a count, by bisection on the cumulative distribution.
function poissonInterval(k) {
  const cdf = (x, l) => { let t = Math.exp(-l), s = t; for (let i = 1; i <= x; i++) { t *= l / i; s += t; } return s; };
  const solve = (f, target) => { let lo = 0, hi = k * 5 + 20; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid) > target) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  return [k === 0 ? 0 : solve((l) => cdf(k - 1, l), 0.975), solve((l) => cdf(k, l), 0.025)];
}
const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];

// A template id reads as `cold-email-v12`; the page shows it in words, the version kept since two
// versions of one template are different prompts.
function templateLabel(id) {
  const m = /^(.*?)(?:-v(\d+))?(-landing)?$/.exec(id);
  const base = (m[1] || id).replace(/^blind-discovery-email$/, "blind-discovery").replace(/-/g, " ");
  const words = base.charAt(0).toUpperCase() + base.slice(1);
  return `${words}${m[2] ? ` v${m[2]}` : ""}${m[3] ? " (landing)" : ""}`;
}

// A workflow reads as what it runs ON THIS CREW'S LEG: every research figure is one leg of one
// channel, so a workflow's model and template are the ones that wrote its emails on that leg. Two
// workflows can run the same model and template (a new version of the workflow keeps both), so
// the month it first sent tells them apart, and a number only when that is shared too.
function buildWorkflowLabels(key) {
  const meta = facts.research.workflowMeta[key];
  if (!meta) throw new Error(`facts.json carries no ${key} workflowMeta: re-run derive.mjs`);
  const firstMonth = {};
  for (const [wf, rows] of Object.entries(facts.research[key].workflowByMonth)) {
    const m = rows[0]?.bucket;
    if (m && (!firstMonth[wf] || m < firstMonth[wf])) firstMonth[wf] = m;
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
}
const WORKFLOW_LABEL = { reply: buildWorkflowLabels("reply"), visit: buildWorkflowLabels("visit") };
const workflowLabelFor = (key) => (wf) => {
  const l = WORKFLOW_LABEL[key][wf];
  if (!l) throw new Error(`no label for a workflow in the research block`);
  return l;
};

// A bar's key names the page it opens. A model's bucket is its label ("Gemini 3.1 Pro"), so its
// key is a slug; a workflow's (dynasty slug) and a template's (template id) are already ids.
const modelKey = (label) => label.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
const MODEL_LABELS = new Set(Object.values(MODEL_LABEL));
const keyOf = (bucket) => (MODEL_LABELS.has(bucket) ? modelKey(bucket) : bucket);

// ---------- the two outcomes ----------
// The month the cutoff falls INSIDE: only the people served before the cutoff day count in it, so
// its bar is IN PROGRESS (`partial`, drawn dotted) and will move at the next read. A cutoff on the
// 1st leaves every counted month whole. derive.mjs files no month after the last cohort month.
for (const l of [M.legs.reply, M.legs.visit]) {
  if (!/^\d{4}-\d{2}$/.test(l.lastCohortMonth || "")) throw new Error(`researchMaturity carries no lastCohortMonth for ${l.legKey}: re-run derive.mjs`);
}
function partialMonthOf(l) {
  return l.cutoff.slice(8, 10) === "01" ? null : l.cutoff.slice(0, 7);
}
const IN_PROGRESS = "month in progress";
// a month series past its leg's last cohort month means derive.mjs filed a month nobody is counted in
function assertCohortMonths(o, series) {
  const late = series.find((r) => r.bucket > o.lastCohortMonth);
  if (late) throw new Error(`${o.crew}: a month bar after the last cohort month (${late.bucket} > ${o.lastCohortMonth}): re-run derive.mjs`);
}

const OUTCOMES = {
  reply: {
    crew: "herald",
    leg: "start_to_conversation",
    noun: "positive reply",
    nounPlural: "positive replies",
    count: "replies",
    cost: "cpr",
    rate: "repliesPerTenThousand",
    rateUnit: "per 10,000 emails",
    rateShort: "/10k",
    per: 10000,
    pct: true,
    outcomesRequired: M.legs.reply.outcomesRequired,
    lastCohortMonth: M.legs.reply.lastCohortMonth,
    partialMonth: partialMonthOf(M.legs.reply),
    emailsNoun: "emails",
  },
  visit: {
    crew: "scout",
    leg: "start_to_website_visit",
    noun: "website visit",
    nounPlural: "website visits",
    count: "clicks",
    cost: "cpc",
    rate: "clicksPerThousand",
    rateUnit: "per 1,000 emails with a link",
    rateShort: "/1k",
    per: 1000,
    pct: true,
    outcomesRequired: M.legs.visit.outcomesRequired,
    lastCohortMonth: M.legs.visit.lastCohortMonth,
    partialMonth: partialMonthOf(M.legs.visit),
    emailsNoun: "emails with a link",
  },
};

const counts = (o, row) => `${n(row[o.count])} ${row[o.count] === 1 ? o.noun : o.nounPlural} · ${n(row.emails)} ${o.emailsNoun}`;
// Rates read as a percent, two decimals. v is per `o.per` emails, so divide by per/100.
const pctOf = (o, v) => v / (o.per / 100);
const rateText = (o, v) => (o.pct ? `${pctOf(o, v).toFixed(2)}%` : `${v.toFixed(1)} ${o.rateShort}`);
const rateLabel = (o) => (o.pct ? `${o.noun} rate` : `${o.nounPlural} ${o.rateUnit}`);
const rateSentence = (o, v) => (o.pct ? `a ${rateText(o, v)} ${o.noun} rate` : `${v.toFixed(1)} ${o.nounPlural} ${o.rateUnit}`);

// A bar is LEARNING (the `thin` flag) when it rests on fewer outcomes than the leg requires,
// features-service's own count: drawn at its rank, marked, and weighed with its counts.
const learningOf = (o, r) => r[o.count] < o.outcomesRequired;
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
    thin: learningOf(o, r),
  }));
}
// Rates: every bucket is drawn, a zero included; one short of the leg's outcome count is marked
// Learning. Owner rule (2026-09-27): no volume filter, exactly as on the cost chart.
function rateBars(o, rows, label = (b) => b, { ordinal = false, keyed = false } = {}) {
  const drawn = rows.filter((r) => r.emails > 0);
  const ordered = ordinal ? drawn : [...drawn].sort((a, b) => b[o.rate] - a[o.rate] || b.emails - a.emails);
  return ordered.map((r) => ({
    ...(keyed ? { key: keyOf(r.bucket) } : {}),
    label: label(r.bucket),
    value: r[o.rate],
    display: rateText(o, r[o.rate]),
    note: counts(o, r),
    thin: learningOf(o, r),
  }));
}

// The winner is the first bar of the chart, Learning or not: the cheapest price on cost, the
// highest rate on rate. `crowned` says whether it rests on enough outcomes to be more than Learning.
function costWinner(o, rows) {
  const priced = rows.filter((r) => r[o.cost] !== null);
  if (!priced.length) return null;
  const row = [...priced].sort(byCost(o))[0];
  return { row, crowned: !learningOf(o, row) };
}
function rateWinner(o, rows) {
  const drawn = rows.filter((r) => r.emails > 0 && r[o.count] > 0);
  if (!drawn.length) return null;
  const row = [...drawn].sort((a, b) => b[o.rate] - a[o.rate] || b.emails - a.emails)[0];
  return { row, crowned: !learningOf(o, row) };
}

function monthLine(o, series, kind) {
  if (!series) return [];
  assertCohortMonths(o, series);
  return series
    .filter((r) => (kind === "cost" ? r[o.cost] !== null : r.emails > 0))
    .map((r) => ({
      label: monthLabel(r.bucket),
      value: kind === "cost" ? r[o.cost] : r[o.rate],
      display: kind === "cost" ? usd(r[o.cost]) : rateText(o, r[o.rate]),
      note: r.bucket === o.partialMonth ? `${counts(o, r)} · ${IN_PROGRESS}` : counts(o, r),
      thin: learningOf(o, r),
      ...(r.bucket === o.partialMonth ? { partial: true } : {}),
    }));
}
// The average SINCE INCEPTION at the end of each month: everything spent (or sent) up to that
// month over every outcome up to it. A month with no outcome still carries its spend, so the
// average climbs through a dry spell instead of skipping it. Written here, never in the browser.
function sinceInception(o, series, kind) {
  if (!series) return [];
  assertCohortMonths(o, series);
  let spend = 0, got = 0, emails = 0;
  const out = [];
  for (const r of series) {
    spend += r.spend; got += r[o.count]; emails += r.emails;
    if (kind === "cost" ? got === 0 : emails === 0) continue;
    const value = kind === "cost" ? spend / got : (got / emails) * o.per;
    out.push({
      label: monthLabel(r.bucket),
      value: Number(value.toFixed(2)),
      display: kind === "cost" ? usd(value) : rateText(o, value),
      note: `${n(got)} ${got === 1 ? o.noun : o.nounPlural} · ${n(emails)} ${o.emailsNoun} to date${r.bucket === o.partialMonth ? ` · ${IN_PROGRESS}` : ""}`,
      thin: got < o.outcomesRequired,
      ...(r.bucket === o.partialMonth ? { partial: true } : {}),
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
    note: RULE_NOTE,
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

// ---------- like for like ----------
// A crude bar mixes clients and months: a model that ran for the clients who click most "wins"
// without writing better emails. So every LLM study also weighs its winner against each other LLM
// on the SAME client in the SAME month only (like-for-like.mjs, over derive.mjs modelStrata).
// a ratio on 1 outcome against 8 spans 0.00x to 1,900x: print the counts instead
const LFL_MIN = 5;
function likeForLikeLines(o, strata, winner, { goal }) {
  if (!strata || !strata[winner]) return [];
  const out = [];
  for (const other of Object.keys(strata)) {
    if (other === winner) continue;
    const pairs = sharedPairs(strata[winner], strata[other], o.count);
    if (pairs.length) out.push({ other, ...likeForLike(pairs) });
  }
  if (!out.length) return [`Same clients, same months: ${winner} ran for no client in a month another LLM also wrote for, so it has no like-for-like comparison.`];
  const x = (r) => `${r.toFixed(2)}x`;
  return out
    .sort((p, q) => q.b.emails - p.b.emails)
    .slice(0, 3)
    .map((c) => {
      const tally = `${n(c.a.outcomes)} ${c.a.outcomes === 1 ? o.noun : o.nounPlural} in ${n(c.a.emails)} ${o.emailsNoun} against ${n(c.b.outcomes)} in ${n(c.b.emails)}`;
      if (c.a.outcomes < LFL_MIN || c.b.outcomes < LFL_MIN || !c.rate) return `Same clients, same months, ${winner} against ${c.other}: ${tally}, under ${LFL_MIN} on one side, so no ratio.`;
      const { ratio, lo, hi } = c.rate;
      if (goal === "rate") return `Same clients, same months, ${winner} gets ${x(ratio)} the ${o.nounPlural} per email of ${c.other} (95% interval ${x(lo)} to ${x(hi)}; ${tally}).`;
      return `Same clients, same months, a ${o.noun} from ${winner} costs ${x(c.cost.ratio)} one from ${c.other} (95% interval ${x(c.cost.lo)} to ${x(c.cost.hi)}; ${x(ratio)} the ${o.nounPlural} per email; ${tally}).`;
    });
}

// ---------- studies ----------
const studies = [];
const add = (s) => studies.push(s);

function dimensionStudies(key, o, R, { dim, dimNoun, cutKey, byMonthKey, label, strataKey }) {
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
        { kind: "bars", title: costTitle(o), lowerIsBetter: true, points: costBars(o, rows, label, { keyed }), note: RULE_NOTE },
        ...(w && line.length ? [monthsChart(o, R[byMonthKey][w.row.bucket], "cost", label(w.row.bucket), true)] : []),
      ],
      conclusion: [
        w ? `${label(w.row.bucket)}: ${counts(o, w.row)}, ${usd(w.row.spend)} spent.` : `Nothing priced yet.`,
        ...(moved ? [`Over time: ${moved}.`] : []),
        ...(w && strataKey ? likeForLikeLines(o, R[strataKey], w.row.bucket, { goal: "roi" }) : []),
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
        { kind: "bars", title: rateTitle(o), lowerIsBetter: false, points: rateBars(o, rows, label, { keyed }), note: RULE_NOTE },
        ...(w && line.length ? [monthsChart(o, R[byMonthKey][w.row.bucket], "rate", label(w.row.bucket), false)] : []),
      ],
      conclusion: [
        w ? `${label(w.row.bucket)}: ${counts(o, w.row)}.` : null,
        ...(moved ? [`Over time: ${moved}.`] : []),
        ...(w && strataKey ? likeForLikeLines(o, R[strataKey], w.row.bucket, { goal: "rate" }) : []),
        `A ${dimNoun} with fewer than ${o.outcomesRequired} ${o.outcomesRequired === 1 ? o.noun : o.nounPlural} is ranked where its value puts it and marked Learning.`,
      ].filter(Boolean),
    });
  }
}

// ---------- naming the client (positive-reply leg only) ----------
// The classification, the two sides and the p-values live in naming/naming.mjs (its blog article
// was taken down on 2026-10-02: the headline was a signal, not a conclusion).
function namingStudies(o, R) {
  const LABEL = NAMING_LABEL;
  const WITH = { held: "with the client not named", named: "with the client named" };
  const { rows, held, named, silent, unrecorded } = namingSides(o, R, templateTexts);
  const pools = [
    `${LABEL.held}: ${counts(o, held)}, ${usd(held.spend)} spent, over ${held.versions} template versions whose prompt tells the model never to name the client or give its website.`,
    `${LABEL.named}: ${counts(o, named)}, ${usd(named.spend)} spent, over ${named.versions} template versions whose prompt tells the model to name the client, some with a link to its website.`,
    ...(silent > 0 ? [`${n(silent)} emails from templates whose prompt says neither are left out.`] : []),
    ...(unrecorded > 0 ? [`${n(unrecorded)} emails whose template was not recorded are left out.`] : []),
    `The two sides ran for different clients, audiences and months: this is not a split test.`,
  ];
  // rate
  {
    const pv = rateP(held, named, o);
    const [a, b] = [...rows].sort((x, y) => y[o.rate] - x[o.rate]);
    // The winner is the first bar, always (owner rule): the p-value is shown, it never withholds it.
    const sig = pv < 0.05 && a[o.rate] > b[o.rate];
    add({
      id: `${o.crew}-naming-rate`,
      crew: o.crew,
      topic: "naming",
      goal: "rate",
      question: `Does naming the client get more ${o.nounPlural}?`,
      status: "measured",
      headline: `${a.bucket} wins: ${rateSentence(o, a[o.rate])}, against ${rateText(o, b[o.rate])} ${WITH[b.side]} (p ${pText(pv)}).`,
      winner: a.bucket,
      result: { display: rateText(o, a[o.rate]), unit: `${WITH[a.side]}, ${rateText(o, b[o.rate])} ${WITH[b.side].replace("with the client ", "")}`, sample: `p ${pText(pv)}, ${n(held.emails + named.emails)} ${o.emailsNoun}` },
      crowned: sig,
      charts: [{ kind: "bars", title: rateTitle(o), lowerIsBetter: false, points: rateBars(o, rows), note: RULE_NOTE }],
      conclusion: [...pools, `The p-value asks whether ${o.nounPlural} per email differ between the two sides.`],
    });
  }
  // cost
  {
    const pv = costP(held, named, o);
    const priced = rows.filter((r) => r[o.cost] !== null).sort(byCost(o));
    const [a, b] = priced;
    // The winner is the cheaper side, always (owner rule); only a side with no outcome at all is unpriced.
    const sig = Boolean(a && b) && pv < 0.05;
    add({
      id: `${o.crew}-naming-roi`,
      crew: o.crew,
      topic: "naming",
      goal: "roi",
      question: `Does naming the client get a cheaper ${o.noun}?`,
      status: priced.length ? "measured" : "not_enough_data",
      headline: !priced.length
        ? `Neither side has earned a ${o.noun} yet.`
        : b
          ? `${a.bucket} wins at ${usd(a[o.cost])} per ${o.noun}, against ${usd(b[o.cost])} ${WITH[b.side]} (p ${pText(pv)}).`
          : `${a.bucket} wins at ${usd(a[o.cost])} per ${o.noun}; no ${o.noun} yet ${WITH[a.side === "held" ? "named" : "held"]} (p ${pText(pv)}).`,
      winner: a ? a.bucket : null,
      result: a ? { display: usd(a[o.cost]), unit: `per ${o.noun} ${WITH[a.side]}${b ? `, ${usd(b[o.cost])} ${WITH[b.side].replace("with the client ", "")}` : ""}`, sample: `p ${pText(pv)}, ${n(held[o.count] + named[o.count])} ${o.nounPlural}` } : null,
      crowned: sig,
      charts: [{ kind: "bars", title: costTitle(o), lowerIsBetter: true, points: costBars(o, rows), note: RULE_NOTE }],
      conclusion: [
        ...pools,
        `An email ${WITH.held} cost ${usd(held.spend / held.emails)} to write and send, ${usd(named.spend / named.emails)} ${WITH.named}.`,
        `The p-value asks whether ${o.nounPlural} per dollar spent differ between the two sides.`,
      ],
    });
  }
}

// ---------- how the first email is laid out, and how it opens ----------
// Every email of a sequence is filed under its FIRST email's layout / opening (derive.mjs, rule in
// first-email-shape.mjs), so a bucket's cost is the whole sequence's spend over every outcome it
// earned. One chart over all emails, then one per tier: the model picked both on its own, and a
// Flash model and a Pro model may not pick alike.
const SHAPE = {
  layout: {
    question: (o) => `Does the layout of the first email change what a ${o.noun} costs?`,
    how: `Three layouts: one block (no line break at all), single line breaks (a new line with no empty line), double line breaks (an empty line between paragraphs).`,
    cutKey: "byLayout",
    tierKey: "layoutByTier",
    missing: "noLayout",
    missingText: "whose first email text is not on record",
  },
  opening: {
    question: (o) => `Does the way the first email opens change what a ${o.noun} costs?`,
    how: `A greeting word in any language we write in (Hi, Hallo, Bonjour...) counts as a greeting whatever follows; a first name followed by a comma, a colon or a dash, with no greeting word before it ("Marie, most clinics..."), counts as the first name alone.`,
    cutKey: "byOpening",
    tierKey: "openingByTier",
    missing: "noOpening",
    missingText: "whose first email text is not on record",
  },
};
// Every bucket that sent anything is drawn, the three layouts included when one has earned no
// outcome yet: it has no price, so its bar runs the full length of the chart (it cost at least as
// much as the dearest priced bucket, having bought nothing) and reads "None yet", marked Learning.
function shapeBars(o, rows) {
  const priced = costBars(o, rows);
  const max = priced.reduce((m, p) => Math.max(m, p.value), 0);
  const none = rows
    .filter((r) => r[o.cost] === null && r.emails > 0)
    .sort((a, b) => b.emails - a.emails)
    .map((r) => ({ label: r.bucket, value: max, display: "None yet", note: `${counts(o, r)}, ${usd(r.spend)} spent`, thin: true }));
  return [...priced, ...none];
}
function shapeStudies(key, o, R, dim) {
  const d = SHAPE[dim];
  const rows = R[d.cutKey];
  const w = costWinner(o, rows);
  const tiers = ["Flash", "Pro"].map((t) => ({ t, rows: R[d.tierKey][t] || [] })).filter((x) => x.rows.some((r) => r.emails > 0));
  const tierWin = tiers.map(({ t, rows: tr }) => ({ t, w: costWinner(o, tr) })).filter((x) => x.w);
  const missing = R.firstShape[d.missing];
  const last = R.firstShape.lastMonth;
  const crm = key === "reply" ? facts.research.crmReplies : null;
  add({
    id: `${o.crew}-${dim}-roi`,
    crew: o.crew,
    topic: dim,
    goal: "roi",
    question: d.question(o),
    status: w ? "measured" : "not_enough_data",
    headline: w ? `${w.row.bucket} wins at ${usd(w.row[o.cost])} per ${o.noun}.` : `No ${o.noun} yet in any bucket.`,
    winner: w ? w.row.bucket : null,
    result: w ? { display: usd(w.row[o.cost]), unit: `per ${o.noun}`, sample: counts(o, w.row) } : null,
    crowned: w ? w.crowned : false,
    charts: [
      { kind: "bars", title: `All tiers: ${costTitle(o).charAt(0).toLowerCase()}${costTitle(o).slice(1)}`, lowerIsBetter: true, points: shapeBars(o, rows), note: RULE_NOTE },
      ...tiers.map(({ t, rows: tr }) => ({ kind: "bars", title: `${t} tier: ${costTitle(o).charAt(0).toLowerCase()}${costTitle(o).slice(1)}`, lowerIsBetter: true, points: shapeBars(o, tr), note: RULE_NOTE })),
    ],
    conclusion: [
      w ? `${w.row.bucket}: ${counts(o, w.row)}, ${usd(w.row.spend)} spent.` : null,
      ...tierWin.map(({ t, w: tw }) => `${t} tier: ${tw.row.bucket} is cheapest at ${usd(tw.row[o.cost])} per ${o.noun} (${counts(o, tw.row)}).`),
      `Every email of a sequence is filed under how its first email looked, and the sequence's ${o.nounPlural} with it. ${d.how} Classified by a regex on the text of the first email, no LLM involved.`,
      `The model chose this on its own until Sep 28, 2026, when the templates started requiring a greeting and blank-line paragraphs. Every email here was written before${last ? `, the last in ${monthLabel(last)}` : ""}.`,
      ...(missing > 0 ? [`${n(missing)} ${o.emailsNoun} ${d.missingText} are left out.`] : []),
      ...(crm && crm.added > 0 ? [`${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} include ${n(crm.added)} the client recorded in their CRM (a phone call, a LinkedIn message), as the dashboard counts them.`] : []),
      `The buckets ran for different clients, audiences and months: this is not a split test.`,
    ].filter(Boolean),
  });
}

// ---------- dashes in the first email ----------
// Em dash / en dash / neither in the first email (first-email-shape.mjs, a character test on the
// generated text). Every email of a sequence is filed under its first email's class, as for the
// layout and the opening. Cost AND rate, all tiers then Flash and Pro, and the models behind each
// bucket: dash use is mostly a model habit, so a gap between buckets is read against that.
const pctText = (v) => `${Math.round(v * 100)}%`;
function dashStudy(key, o, R) {
  const rows = R.byDash;
  const w = costWinner(o, rows);
  const tiers = ["Flash", "Pro"].map((t) => ({ t, rows: R.dashByTier[t] || [] })).filter((x) => x.rows.some((r) => r.emails > 0));
  const tierWin = tiers.map(({ t, rows: tr }) => ({ t, w: costWinner(o, tr) })).filter((x) => x.w);
  const both = R.dashBoth;
  const missing = R.firstShape.noDash;
  const last = R.firstShape.lastMonth;
  const crm = key === "reply" ? facts.research.crmReplies : null;
  const low = (t) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  // A model's first emails, filed by class. "With a dash" is every class but the no-dash one.
  const models = R.dashByModel.filter((m) => m.emails > 0);
  const withDash = (m) => m.emails - (m.classes["No dash"] || 0);
  const modelBars = models
    .map((m) => ({
      label: m.model,
      value: Number(((withDash(m) / m.emails) * 100).toFixed(1)),
      display: pctText(withDash(m) / m.emails),
      note: `${n(withDash(m))} with a dash · ${n(m.emails)} ${o.emailsNoun}`,
      thin: false,
    }))
    .sort((a, b) => b.value - a.value);
  // Which model wrote most of a bucket, per tier: the plain statement of the confound.
  const bucketsOf = (m) => (both.folded ? { ...m.classes, "Em dash": (m.classes["Em dash"] || 0) + (m.classes["Both dashes"] || 0) } : m.classes);
  const mainModel = (tier, bucket) => {
    const ms = models.filter((m) => m.tier === tier);
    const total = ms.reduce((a, m) => a + (bucketsOf(m)[bucket] || 0), 0);
    if (!total) return null;
    const top = ms.reduce((b, m) => ((bucketsOf(m)[bucket] || 0) > (bucketsOf(b)[bucket] || 0) ? m : b));
    return { model: top.model, share: (bucketsOf(top)[bucket] || 0) / total };
  };
  const confound = tiers
    .map(({ t }) => {
      const parts = ["Em dash", "No dash"].map((b) => ({ b, m: mainModel(t, b) })).filter((x) => x.m);
      if (!parts.length) return null;
      const said = `${t} tier: ${parts.map(({ b, m }) => `${pctText(m.share)} of the ${b === "No dash" ? "no-dash" : "em dash"} emails come from ${m.model}`).join(", ")}`;
      if (parts.length < 2) return `${said}.`;
      if (parts[0].m.model !== parts[1].m.model) return `${said}: different models, so within this tier the gap is largely a model gap, not a dash effect.`;
      return parts.every((x) => x.m.share >= 0.5)
        ? `${said}: one model writes most of both, so within this tier the gap is closer to a dash effect.`
        : `${said}: the same model leads both but does not write most of each, so within this tier dashes and models are mixed.`;
    })
    .filter(Boolean);
  const top = modelBars[0], bottom = modelBars[modelBars.length - 1];
  add({
    id: `${o.crew}-dash-roi`,
    crew: o.crew,
    topic: "dash",
    goal: "roi",
    question: `Do dashes in the first email change what a ${o.noun} costs, and how often one comes?`,
    status: w ? "measured" : "not_enough_data",
    headline: w ? `${w.row.bucket} wins at ${usd(w.row[o.cost])} per ${o.noun}.` : `No ${o.noun} yet in any bucket.`,
    winner: w ? w.row.bucket : null,
    result: w ? { display: usd(w.row[o.cost]), unit: `per ${o.noun}`, sample: counts(o, w.row) } : null,
    crowned: w ? w.crowned : false,
    charts: [
      { kind: "bars", title: `All tiers: ${low(costTitle(o))}`, lowerIsBetter: true, points: shapeBars(o, rows), note: RULE_NOTE },
      { kind: "bars", title: `All tiers: ${low(rateTitle(o))}`, lowerIsBetter: false, points: rateBars(o, rows), note: RULE_NOTE },
      ...tiers.flatMap(({ t, rows: tr }) => [
        { kind: "bars", title: `${t} tier: ${low(costTitle(o))}`, lowerIsBetter: true, points: shapeBars(o, tr), note: RULE_NOTE },
        { kind: "bars", title: `${t} tier: ${low(rateTitle(o))}`, lowerIsBetter: false, points: rateBars(o, tr), note: RULE_NOTE },
      ]),
      { kind: "bars", title: `Share of first emails with a dash, by model (%)`, lowerIsBetter: false, points: modelBars, note: RULE_NOTE },
    ],
    conclusion: [
      w ? `${w.row.bucket}: ${counts(o, w.row)}, ${usd(w.row.spend)} spent, ${rateSentence(o, w.row[o.rate])}.` : null,
      ...tierWin.map(({ t, w: tw }) => `${t} tier: ${tw.row.bucket} is cheapest at ${usd(tw.row[o.cost])} per ${o.noun} (${counts(o, tw.row)}).`),
      top && bottom && top !== bottom
        ? `Dashes are a model habit: ${top.label} puts one in ${top.display} of its first emails, ${bottom.label} in ${bottom.display}. Read each tier against the models writing its buckets.`
        : null,
      ...confound,
      `Three buckets on the first email's text: an em dash, an en dash, neither. A plain hyphen is not a dash. ${both.folded ? `The ${n(both.emails)} ${o.emailsNoun} whose first email carries both (${(both.share * 100).toFixed(1)}%, under ${Math.round(both.min * 100)}%) are counted with the em dash.` : `An email carrying both is its own bucket (${n(both.emails)} ${o.emailsNoun}, ${(both.share * 100).toFixed(1)}%).`} Every email of a sequence is filed under its first email, and the sequence's ${o.nounPlural} with it. Classified by a character test on the text, no LLM involved.`,
      `Our templates never banned dashes until Sep 29, 2026, when every template started forbidding both. Every email here was generated before that date${last ? ` (the last in ${monthLabel(last)})` : ""}.`,
      ...(missing > 0 ? [`${n(missing)} ${o.emailsNoun} whose first email text is not on record are left out.`] : []),
      ...(crm && crm.added > 0 ? [`${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} include ${n(crm.added)} the client recorded in their CRM (a phone call, a LinkedIn message), as the dashboard counts them.`] : []),
      `The buckets ran for different clients, audiences and months: this is not a split test.`,
    ].filter(Boolean),
  });
}

for (const key of ["reply", "visit"]) {
  const o = OUTCOMES[key];
  const R = facts.research[key];

  dimensionStudies(key, o, R, { dim: "llm", dimNoun: "LLM", cutKey: "byModel", byMonthKey: "modelByMonth", label: (b) => b, strataKey: "modelStrata" });

  // cost: the AVERAGE since inception (everything spent over every outcome, all months pooled),
  // never the last month on its own. The monthly bars stay beside it as context.
  {
    const avg = sinceInception(o, R.byMonth, "cost");
    // The cheapest LLM is the LLM study's question, under its own verdict: not repeated here.
    const all = avg.length ? avg[avg.length - 1] : null;
    add({
      id: `${o.crew}-cost-over-time`,
      crew: o.crew,
      topic: "cost",
      goal: "roi",
      question: `What does a ${o.noun} cost on average?`,
      status: all ? "measured" : "not_enough_data",
      headline: all ? `${all.display} per ${o.noun} on average since inception, across all our emails${o.crew === "scout" ? " whose clicks are screened for bots" : ""}.` : `Not enough ${o.nounPlural} to state an average yet.`,
      winner: null,
      // the sample states the counts to date; the in-progress mark belongs to the chart's last bar
      result: all ? { display: all.display, unit: `per ${o.noun}, average since inception`, sample: all.note.replace(` · ${IN_PROGRESS}`, "") } : null,
      crowned: false,
      charts: [monthsChart(o, R.byMonth, "cost", "All our emails", true)],
      conclusion: [`The average divides everything spent since the first email by every ${o.noun} since; the monthly bars are context, not the answer.`],
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
      thin: d.got < o.outcomesRequired,
    }));
    const per = key === "reply" ? 10000 : 1000;
    const ratePts = people ? depth.map((d) => ({
      label: d.label,
      value: Number(((d.got / people) * per).toFixed(1)),
      display: rateText(o, (d.got / people) * per),
      note: `${n(d.got)} ${d.got === 1 ? o.noun : o.nounPlural} from ${n(people)} people`,
      thin: d.got < o.outcomesRequired,
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
        { kind: "bars", title: `Cost per ${o.noun} if the sequence stopped here (USD, lower is better)`, lowerIsBetter: true, points: roiPts, note: RULE_NOTE },
        { kind: "bars", title: `Each email on its own: cost per ${o.noun} (USD, lower is better)`, lowerIsBetter: true, points: stepCost, note: RULE_NOTE },
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
      crowned: depth.length > 0 && depth[depth.length - 1].got >= o.outcomesRequired,
      charts: [
        { kind: "bars", title: o.pct ? `${o.noun.charAt(0).toUpperCase()}${o.noun.slice(1)} rate, % of people, adding each follow-up (higher is better)` : `${o.nounPlural.charAt(0).toUpperCase()}${o.nounPlural.slice(1)} per 1,000 people, adding each follow-up (higher is better)`, lowerIsBetter: false, points: ratePts, note: RULE_NOTE },
      ],
      conclusion: [
        `Counted per person reached, so a follow-up is judged on what it adds, not on how many emails it took.`,
        ...gains.map((g) => `${g.label}: ${g.gain >= 0 ? "+" : ""}${o.pct ? `${pctOf(o, g.gain).toFixed(2)} points` : `${g.gain} ${o.rateShort}`}.`),
      ],
    });
  }

  // open tracking: the pixel study (two periods, not a split test). The pixel only ever ran on
  // provider-sent emails, whose clicks no scanner classifier screens, so the "tracking on" arm
  // holds no human visit by construction: the website-visit question cannot be measured.
  if (key === "visit") {
    const reason = "The open pixel only ran on emails sent through the provider, whose clicks cannot be told apart from link scanners. A website visit is a human click, so this cannot be measured.";
    for (const [goal, question] of [["roi", `Should we track opens for the cheapest ${o.noun}?`], ["rate", `Should we track opens for the most website visits?`]]) {
      add({ id: `${o.crew}-opens-${goal}`, crew: o.crew, topic: "opens", goal, question, status: "not_enough_data", headline: "Cannot be measured on human visits.", winner: null, crowned: false, result: null, charts: [], conclusion: [reason] });
    }
  } else {
    const metric = key === "reply" ? pixel.positive : pixel.clicked;
    const rateMetric = key === "reply" ? pixel.replied : pixel.clicked;
    const arm = (m, which) => ({
      label: which === "off" ? "Tracking off" : "Tracking on",
      value: m[which].pct,
      display: `${m[which].pct.toFixed(2)}%`,
      note: `${n(m[which].count)} of ${n(m[which].of)} people`,
      thin: false,
    });
    // The winner is the arm with more, always the first bar (owner rule): the p-value is shown,
    // it never withholds the winner.
    const lead = (m) => (m.off.pct >= m.on.pct ? "off" : "on");
    const other = (w) => (w === "off" ? "on" : "off");
    const leader = (m) => (lead(m) === "off" ? "Tracking off" : "Tracking on");
    const armsLeadFirst = (m) => [arm(m, lead(m)), arm(m, other(lead(m)))];
    const verdict = (m, what) => {
      const w = lead(m);
      return `Tracking ${w} wins: ${m[w].pct.toFixed(2)}% of people ${what}, against ${m[other(w)].pct.toFixed(2)}% (p ${m.p}).`;
    };
    // The result cell states both arms, the winner first.
    const armResult = (m) => {
      const w = lead(m), l = other(w);
      return { display: `${m[w].pct.toFixed(2)}%`, unit: `with tracking ${w}, ${m[l].pct.toFixed(2)}% ${l}`, sample: `p ${m.p}, ${n(m.off.of + m.on.of)} people` };
    };
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
      winner: leader(metric),
      result: armResult(metric),
      crowned: metric.significant,
      charts: [{ kind: "bars", title: `People who ${what} (%, higher is better)`, lowerIsBetter: false, points: armsLeadFirst(metric), note: PIXEL_NOTE }],
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
      winner: leader(rateMetric),
      result: armResult(rateMetric),
      crowned: rateMetric.significant,
      charts: [
        { kind: "bars", title: key === "reply" ? `People who replied, any reply (%, higher is better)` : `People who visited the website (%, higher is better)`, lowerIsBetter: false, points: armsLeadFirst(rateMetric), note: PIXEL_NOTE },
        ...(key === "reply" ? [{ kind: "bars", title: `Bounced (%, lower is better)`, lowerIsBetter: true, points: [arm(pixel.bounced, "off"), arm(pixel.bounced, "on")], note: PIXEL_NOTE }] : []),
      ],
      conclusion: [
        key === "reply" ? `Auto-replies and out-of-office messages are not counted as replies.` : `A visit is the first tracked click a person made.`,
        periods,
      ],
    });
  }

  dimensionStudies(key, o, R, { dim: "template", dimNoun: "template", cutKey: "byTemplate", byMonthKey: "templateByMonth", label: templateLabel });
  if (key === "reply") namingStudies(o, R);
  shapeStudies(key, o, R, "layout");
  shapeStudies(key, o, R, "opening");
  dashStudy(key, o, R);

  // The best workflow: one model and one template together, which is what a campaign actually
  // runs. The same floors crown it as every other study.
  dimensionStudies(key, o, R, { dim: "workflow", dimNoun: "workflow", cutKey: "byWorkflow", byMonthKey: "workflowByMonth", label: workflowLabelFor(key) });
}

// Pilot runs on one workflow (one model, one template) since early September: every comparison
// needs at least two, so its cards state that rather than show a single bar as a result.
const PILOT_REASON = "Pilot has run one workflow (one LLM, one template) on 3 campaigns since 2 Sep 2026. A comparison needs at least two.";
for (const [topic, question] of [
  ["llm", "Which LLM books the most meetings from a positive reply?"],
  ["template", "Which template books the most meetings from a positive reply?"],
  ["followups", "How many follow-ups after a positive reply book the most meetings?"],
]) {
  add({ id: `pilot-${topic}`, crew: "pilot", topic, goal: "rate", question, status: "not_enough_data", headline: "Not enough data yet.", winner: null, crowned: false, result: null, charts: [], conclusion: [PILOT_REASON] });
}
// What a booked meeting costs: on the Pilot leg alone, and across every leg as the Meeting booked
// OUTCOME section (meetings.mjs). Both carry their own verdict.
const csvRows = (f) => {
  const [head, ...lines] = readFileSync(join(dataDir, f), "utf8").trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => {
    const v = l.split(",");
    if (v.length !== cols.length) throw new Error(`${f}: a row with ${v.length} fields under ${cols.length} columns`);
    return Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  });
};
const MEETINGS = meetingStudies({
  meetings: csvRows("meetings.csv"),
  acted: csvRows("pilot-acted.csv"),
  campaigns: csvRows("meeting-campaigns.csv"),
  spend: csvRows("meeting-spend.csv"),
  maturity: readJson("maturity.json"),
  // the extract's DAY window (extract.sh writes it), the read day exclusive
  window: readJson("window.json"),
  costBasis: facts.research.costBasis ?? "user",
});
for (const st of MEETINGS.studies) add(st);
for (const [goal, question] of [
  ["roi", "Which workflow books a meeting for the least?"],
  ["rate", "Which workflow books the most meetings from a positive reply?"],
]) {
  add({ id: `pilot-workflow-${goal}`, crew: "pilot", topic: "workflow", goal, question, status: "not_enough_data", headline: "Not enough data yet.", winner: null, crowned: false, result: null, charts: [], conclusion: [PILOT_REASON] });
}

// ---------- catalogue: one page per workflow and per template, per crew ----------
// Read beside facts.json (extract.sh writes them into the same directory). Every row here is
// fleet-wide and names no client and no lead.
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
const COST_BASIS = facts.research.costBasis ?? "user";
if (COST_BASIS === "actual" && workflowRuns.some((x) => x.vendorCents === undefined)) {
  throw new Error("workflow-runs.json carries no vendorCents: re-run extract.sh");
}
function runCost(x) {
  if (!(Number(x.cents) > 0)) return null;
  if (COST_BASIS === "user") return usd(Number(x.cents) / 100);
  return Number(x.unpricedCents) > 0 ? null : usd(Number(x.vendorCents) / 100);
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
  const rest = rows.filter((r) => r[o.cost] === null && r.emails > 0).sort((a, b) => b.emails - a.emails);
  return [...priced, ...rest];
}
function figures(o, r) {
  return {
    emails: n(r.emails),
    emailsNoun: o.emailsNoun,
    outcomes: n(r[o.count]),
    spend: usd(r.spend),
    cost: r[o.cost] === null ? null : usd(r[o.cost]),
    rate: r.emails > 0 ? rateText(o, r[o.rate]) : null,
    thin: learningOf(o, r),
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
  const meta = facts.research.workflowMeta[key];
  const workflowLabel = workflowLabelFor(key);
  // the leg this crew buys: its "last runs" lists read that leg's runs only
  const leg = OUTCOMES[key].leg;
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
        .filter((x) => x.leg === leg && (dynastyOf.get(x.workflowSlug) ?? x.workflowSlug) === r.bucket)
        .slice(0, RUNS_SHOWN)
        .map((x) => ({
          when: whenText(x.startedAt),
          version: versionText(x.workflowSlug),
          status: x.status,
          duration: durationText(x.startedAt, x.completedAt),
          // A run whose every cost was cancelled was not charged: null, never "$0.00". On the actual
          // basis a run carrying billed spend no vendor cost is on record for states none: the
          // priced part alone would read as the whole run.
          cost: runCost(x),
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
        .filter((x) => x.leg === leg && x.template === r.bucket)
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
      .filter((x) => x.leg === leg && (MODEL_LABEL[x.model] || x.model) === r.bucket)
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

// ---------- verdicts ----------
// Every measured study gets one word, conclusion / signal / noise (verdict.mjs), and its headline
// says only what that word allows. The leader stays the first bar whatever the word.
{
  const side = (o, label, r) => (r ? { label, key: r.bucket, outcomes: r[o.count], emails: r.emails, spend: r.spend } : null);
  // leader and runner-up of a categorical cut, in the order its chart draws them
  const pairOf = (o, rows, goal) => {
    const drawn = rows.filter((r) => r.emails > 0);
    if (goal === "rate") {
      const sorted = [...drawn].sort((a, b) => b[o.rate] - a[o.rate] || b.emails - a.emails);
      return { a: sorted[0], b: sorted[1], m: drawn.length - 1 };
    }
    const priced = drawn.filter((r) => r[o.cost] !== null).sort(byCost(o));
    const unpriced = drawn.filter((r) => r[o.cost] === null).sort((x, y) => y.spend - x.spend);
    return { a: priced[0], b: priced[1] ?? unpriced[0], m: drawn.length - 1 };
  };
  const judge = (study, v) => {
    study.verdict = { kind: v.kind, reason: v.reason };
    study.crowned = v.kind === "conclusion";
    if (study.status === "measured") study.headline = headlineFor(study.headline, v.kind);
  };
  const byId = new Map(studies.map((st) => [st.id, st]));
  for (const key of ["reply", "visit"]) {
    const o = OUTCOMES[key];
    const R = facts.research[key];
    const nouns = { noun: o.noun, nouns: o.nounPlural, count: o.count };
    const categorical = [
      { dim: "llm", cut: "byModel", strata: R.modelStrata, label: (b) => b },
      { dim: "template", cut: "byTemplate", strata: R.templateStrata, label: templateLabel },
      { dim: "workflow", cut: "byWorkflow", strata: R.workflowStrata, label: workflowLabelFor(key) },
    ];
    for (const c of categorical) {
      for (const goal of ["roi", "rate"]) {
        const st = byId.get(`${o.crew}-${c.dim}-${goal}`);
        if (!st || st.status !== "measured") continue;
        const { a, b, m } = pairOf(o, R[c.cut], goal);
        judge(st, compareVerdict({ a: side(o, a && c.label(a.bucket), a), b: side(o, b && c.label(b.bucket), b), goal, comparisons: m, strata: c.strata, ...nouns }));
      }
    }
    for (const [dim, cut, strata] of [["layout", "byLayout", R.layoutStrata], ["opening", "byOpening", R.openingStrata], ["dash", "byDash", R.dashStrata]]) {
      const st = byId.get(`${o.crew}-${dim}-roi`);
      if (!st || st.status !== "measured") continue;
      const { a, b, m } = pairOf(o, R[cut], "roi");
      judge(st, compareVerdict({ a: side(o, a?.bucket, a), b: side(o, b?.bucket, b), goal: "roi", comparisons: m, strata, ...nouns }));
    }
    if (key === "reply") {
      // naming: the template strata merged per side, by what each template's prompt says
      const { rows } = namingSides(o, R, templateTexts);
      const strata = {};
      for (const [tpl, byStratum] of Object.entries(R.templateStrata)) {
        const k = namingOf(templateTexts, tpl);
        if (!k) continue;
        const into = (strata[NAMING_LABEL[k]] ||= {});
        for (const [sk, x] of Object.entries(byStratum)) {
          const t = (into[sk] ||= { emails: 0, clicks: 0, replies: 0, spend: 0 });
          t.emails += x.emails; t.clicks += x.clicks; t.replies += x.replies; t.spend += x.spend;
        }
      }
      for (const goal of ["rate", "roi"]) {
        const st = byId.get(`${o.crew}-naming-${goal}`);
        if (!st || st.status !== "measured") continue;
        const { a, b } = pairOf(o, rows, goal);
        judge(st, compareVerdict({ a: side(o, a?.bucket, a), b: side(o, b?.bucket, b), goal, comparisons: 1, strata, ...nouns }));
      }
    }
    // follow-ups: the first email against every follow-up, on the SAME people (no client mix)
    {
      const first = R.byStep.find((s) => s.bucket === "First email");
      const rest = R.byStep.filter((s) => s.bucket !== "First email").reduce((t, s) => ({ emails: t.emails + s.emails, spend: t.spend + s.spend, out: t.out + s[o.count] }), { emails: 0, spend: 0, out: 0 });
      const roi = byId.get(`${o.crew}-followups-roi`);
      if (roi?.status === "measured" && first) {
        const f = { label: "The first email", outcomes: first[o.count], emails: first.emails, spend: first.spend };
        const u = { label: "the follow-ups", outcomes: rest.out, emails: rest.emails, spend: rest.spend };
        const firstCheaper = (f.outcomes / f.spend || 0) >= (u.outcomes / u.spend || 0);
        const [a, b] = firstCheaper ? [f, { ...u, label: "the follow-ups" }] : [{ ...u, label: "The follow-ups" }, { ...f, label: "the first email" }];
        judge(roi, compareVerdict({ a, b, goal: "roi", comparisons: 1, splitTest: true, ...nouns }));
      }
      const rate = byId.get(`${o.crew}-followups-rate`);
      if (rate?.status === "measured") {
        const lastStep = [...R.byStep].reverse().find((s) => s.bucket !== "First email" && s[o.count] > 0);
        const last = lastStep ? lastStep[o.count] : 0;
        const v = rest.out < MIN_OUTCOMES
          ? { kind: "noise", reason: `Follow-ups brought ${n(rest.out)} ${rest.out === 1 ? o.noun : o.nounPlural} in all: too few to say they add any.` }
          : last >= MIN_OUTCOMES
            ? { kind: "conclusion", reason: `Follow-ups brought ${n(rest.out)} of ${n(rest.out + (first?.[o.count] ?? 0))} ${o.nounPlural}, on the same people the first email reached, and the last useful one (${lastStep.bucket.toLowerCase()}) brought ${n(last)} on its own.` }
            : { kind: "signal", reason: `Follow-ups brought ${n(rest.out)} of ${n(rest.out + (first?.[o.count] ?? 0))} ${o.nounPlural}, so they add some; but the last useful one (${lastStep.bucket.toLowerCase()}) brought only ${n(last)}, too few to say how far to go.` };
        judge(rate, v);
      }
    }
    // open tracking: two periods, never a split test, so at best a signal
    for (const goal of ["roi", "rate"]) {
      const st = byId.get(`${o.crew}-opens-${goal}`);
      if (!st) continue;
      const mtr = goal === "roi" ? (key === "reply" ? pixel.positive : pixel.clicked) : key === "reply" ? pixel.replied : pixel.clicked;
      judge(st, mtr.significant
        ? { kind: "signal", reason: `p ${mtr.p}, but tracking was on and off in two different periods, not a split test: the calendar can move this as much as the pixel.` }
        : { kind: "noise", reason: `p ${mtr.p}: a gap chance alone produces often, and the two periods are not a split test.` });
    }
    // the average cost: a measurement, not a comparison
    {
      const st = byId.get(`${o.crew}-cost-over-time`);
      if (st?.status === "measured") {
        const got = R.byMonth.reduce((t, r) => t + r[o.count], 0);
        const spend = R.byMonth.reduce((t, r) => t + r.spend, 0);
        const [lo, hi] = poissonInterval(got);
        judge(st, got >= MIN_OUTCOMES
          ? { kind: "conclusion", reason: `A measurement on ${n(got)} ${o.nounPlural}: 95% interval ${usd(spend / hi)} to ${usd(spend / lo)} per ${o.noun}.` }
          : { kind: "noise", reason: `Only ${n(got)} ${got === 1 ? o.noun : o.nounPlural} so far.` });
      }
    }
  }
  for (const st of studies) if (!st.verdict) st.verdict = { kind: "noise", reason: st.conclusion[0] ?? "Not enough data yet." };
}

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
  // user: what clients were billed. actual (staff only, never bundled for the browser): what the
  // vendors charged us before our markup, with the billed spend no vendor cost prices stated apart.
  costBasis: COST_BASIS,
  unpricedBilledUsd: COST_BASIS === "actual" ? facts.research.scope.unpricedBilledUsd : 0,
  // actual basis only: the emails left out because their workflow version's spend is unpriced
  unpricedEmails: COST_BASIS === "actual" ? facts.research.scope.droppedForNoVendorCost : 0,
  window: { from: facts.research.window.from, to: facts.research.window.to },
  readOn: facts.generatedAt.slice(0, 10),
  volume: {
    // the two crews' legs only (one leg each), never the whole channel
    emails: facts.research.volume.emails,
    orgs: facts.research.volume.orgs,
    workflows: facts.research.volume.workflows,
    linkedEmails: facts.research.volume.linkedEmails,
    // emails sent per month, for the stat tile's small bars
    byMonth: facts.research.volume.byMonth.map((r) => ({ label: monthLabel(r.bucket), emails: r.emails })),
  },
  // features-service's maturity rule, per leg (features-service#1196): read, never measured.
  maturation: {
    rule: "run_start",
    days: RULE_DAYS,
    cutoff: [M.legs.reply.cutoff, M.legs.visit.cutoff].sort()[0],
    windowEnd: M.windowEnd,
    legs: {
      reply: { durationDays: M.legs.reply.durationDays, outcomesRequired: M.legs.reply.outcomesRequired, cutoff: M.legs.reply.cutoff },
      visit: { durationDays: M.legs.visit.durationDays, outcomesRequired: M.legs.visit.outcomesRequired, cutoff: M.legs.visit.cutoff },
    },
    excludedEmails: M.excludedEmails,
    noRunStart: M.noRunStart,
    note: RULE_NOTE,
  },
  crews: [
    { id: "herald", outcome: "Positive reply", description: "Cold email that gets a prospect to answer with interest." },
    { id: "scout", outcome: "Website visit", description: "Cold email that brings a prospect to the website." },
    { id: "pilot", outcome: "Meeting booked", description: "Turns a positive reply into a booked meeting." },
  ],
  outcomes: MEETINGS.outcomes,
  studies,
  catalogCounts,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
