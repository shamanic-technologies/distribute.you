// The OUTCOME studies of the Research page (owner 2026-10-18): one row per outcome (Positive reply,
// Website visit, Meeting booked, and any step a pipe's data measures later), each asking two things
// of it, seven ways: what one costs ($ / outcome, goal roi) and what share of LEADS reach it
// (% conversion, goal rate), overall and since inception, then by pipe, channel, leg, workflow,
// lead strategy and tactic.
//
//  - outcomeCuts (derive.mjs): the counts, from the mature research emails of every pipe whose leg
//    lands on the step. An email carries its spend (marginal, derive.mjs), its outcome flag (the
//    positive reply or the HUMAN website visit it earned), and its lead.
//  - outcomeStudies (research.mjs): the studies, every figure and sentence written here.
//
// A conversion rate counts LEADS at lead-service's own grain (owner 2026-10-18): one `leads.id`,
// a human at a company, the id every cold email row carries. A lead entered the leg when we wrote
// to it on the leg; it reached the outcome when one of those emails earned it. Never people,
// never emails. A cost per outcome divides spend by the outcomes the emails earned, the count every
// pipe study uses, so an outcome reached by one pipe prices exactly as that pipe's own average.
//
// Pure: no I/O, so tests/unit/research-outcomes.test.ts runs both on fixtures.
import { compareVerdict, headlineFor, MIN_OUTCOMES } from "./verdict.mjs";

export const CUTS = ["pipe", "channel", "leg", "workflow", "strategy", "tactic"];
// the cuts whose cost bars split the outcome's average (decompStudy) rather than compare buckets
const SPLIT = new Set(["pipe", "channel", "leg"]);
const YES = "yes";
const NO = "no";

// ---------- derive side ----------

function bucketSet() {
  return new Map();
}
function addTo(map, key, r, month) {
  let b = map.get(key);
  if (!b) {
    b = { emails: 0, spend: 0, outcomes: 0, leads: new Map(), strata: new Map() };
    map.set(key, b);
  }
  b.emails++;
  b.spend += r.cost;
  if (r.hit) b.outcomes++;
  const sk = `${r.orgId}|${month}`;
  let s = b.strata.get(sk);
  if (!s) b.strata.set(sk, (s = { emails: 0, spend: 0, out: 0 }));
  s.emails++;
  s.spend += r.cost;
  if (r.hit) s.out++;
  if (r.leadId) {
    const l = b.leads.get(r.leadId);
    if (!l) b.leads.set(r.leadId, { org: r.orgId, month, reached: r.hit });
    else {
      if (month < l.month) { l.month = month; l.org = r.orgId; }
      if (r.hit) l.reached = true;
    }
  }
}
const round2 = (v) => Number(v.toFixed(2));
function closeBucket(key, b) {
  let reached = 0;
  const leadStrata = {};
  for (const l of b.leads.values()) {
    if (l.reached) reached++;
    const s = (leadStrata[`${l.org}|${l.month}`] ||= { emails: 0, spend: 0, out: 0 });
    s.emails++;
    if (l.reached) s.out++;
  }
  const roiStrata = {};
  for (const [k, s] of b.strata) roiStrata[k] = { emails: s.emails, spend: round2(s.spend), out: s.out };
  return {
    row: { bucket: key, emails: b.emails, spend: round2(b.spend), outcomes: b.outcomes, leads: b.leads.size, reached },
    roiStrata,
    rateStrata: leadStrata,
  };
}

/**
 * sets: one per pipe, { pipe, channel, leg, step, emailsNoun, rows }, each row an email
 *   { workflow, dynasty, strategy, leadId, orgId, month, chartMonth, cost, hit }.
 * verdicts: Map(workflow version slug -> Map(tactic id -> boolean)), Jev's verdict per version.
 * Returns one entry per step the sets land on, every count the studies need.
 */
export function outcomeCuts(sets, verdicts) {
  const bySteps = new Map();
  for (const s of sets) {
    if (!bySteps.has(s.step)) bySteps.set(s.step, []);
    bySteps.get(s.step).push(s);
  }
  const out = [];
  for (const [step, group] of bySteps) {
    const cuts = Object.fromEntries(CUTS.map((c) => [c, bucketSet()]));
    const months = bucketSet();
    const leadFirst = new Map();
    const orgs = new Set();
    let emails = 0, noLead = 0, unattributed = 0, noPlay = 0, unjudged = 0;
    for (const s of group) {
      for (const r of s.rows) {
        emails++;
        if (r.orgId) orgs.add(r.orgId);
        if (!r.leadId) noLead++;
        const row = { ...r, pipe: s.pipe, channel: s.channel, leg: s.leg };
        addTo(cuts.pipe, s.pipe, row, r.month);
        addTo(cuts.channel, s.channel, row, r.month);
        addTo(cuts.leg, s.leg, row, r.month);
        if (r.dynasty) addTo(cuts.workflow, r.dynasty, row, r.month);
        if (r.strategy) addTo(cuts.strategy, r.strategy, row, r.month);
        else if (r.strategyState === "unattributed") unattributed++;
        else noPlay++;
        const v = verdicts.get(r.workflow);
        if (!v || !v.size) unjudged++;
        else for (const [t, yes] of v) addTo(cuts.tactic, `${t}|${yes ? YES : NO}`, row, r.month);
        // the month series: spend and outcomes on the email's own chart month, a lead on the
        // chart month of its first email
        const m = (months.get(r.chartMonth) || months.set(r.chartMonth, { emails: 0, spend: 0, outcomes: 0 }).get(r.chartMonth));
        m.emails++;
        m.spend += r.cost;
        if (r.hit) m.outcomes++;
        if (r.leadId) {
          const l = leadFirst.get(r.leadId);
          if (!l) leadFirst.set(r.leadId, { month: r.chartMonth, reached: r.hit });
          else {
            if (r.chartMonth < l.month) l.month = r.chartMonth;
            if (r.hit) l.reached = true;
          }
        }
      }
    }
    const cohorts = new Map();
    for (const l of leadFirst.values()) {
      const c = cohorts.get(l.month) || cohorts.set(l.month, { leads: 0, reached: 0 }).get(l.month);
      c.leads++;
      if (l.reached) c.reached++;
    }
    const monthKeys = [...new Set([...months.keys(), ...cohorts.keys()])].sort();
    const closed = Object.fromEntries(
      CUTS.map((c) => {
        const keys = [...cuts[c].keys()].sort();
        const parts = keys.map((k) => closeBucket(k, cuts[c].get(k)));
        return [c, {
          rows: parts.map((p) => p.row),
          roiStrata: Object.fromEntries(parts.map((p) => [p.row.bucket, p.roiStrata])),
          rateStrata: Object.fromEntries(parts.map((p) => [p.row.bucket, p.rateStrata])),
        }];
      }),
    );
    out.push({
      step,
      pipes: group.map((s) => ({ pipe: s.pipe, channel: s.channel, leg: s.leg })),
      emailsNoun: group[0].emailsNoun,
      scope: { emails, noLead, orgs: orgs.size, leads: leadFirst.size, unattributed, noPlay, unjudged },
      byMonth: monthKeys.map((k) => {
        const m = months.get(k) || { emails: 0, spend: 0, outcomes: 0 };
        const c = cohorts.get(k) || { leads: 0, reached: 0 };
        return { bucket: k, emails: m.emails, spend: round2(m.spend), outcomes: m.outcomes, leads: c.leads, reached: c.reached };
      }),
      cuts: closed,
    });
  }
  return out;
}

// ---------- research side ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
const dayText = (ymd) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}, ${ymd.slice(0, 4)}`;
const n = (v) => Number(v).toLocaleString("en-US");
const usd = (v) => (Math.abs(v) < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
const pct = (v) => `${v.toFixed(2)}%`;
const IN_PROGRESS = "month in progress";
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** The study id of one cut of one outcome: `outcome-<outcome>-<cut>-<goal>`. */
export const outcomeStudyId = (outcome, cut, goal) => `outcome-${outcome}-${cut}-${goal}`;
/** An outcome's id: its served step label, in words joined by dashes ("Positive reply" -> positive-reply). */
export const outcomeIdOf = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Poisson 95% interval on a count (the same as research.mjs's cost over time).
function poissonInterval(k) {
  const cdf = (x, l) => { let t = Math.exp(-l), s = t; for (let i = 1; i <= x; i++) { t *= l / i; s += t; } return s; };
  const solve = (f, target) => { let lo = 0, hi = k * 5 + 20; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid) > target) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  return [k === 0 ? 0 : solve((l) => cdf(k - 1, l), 0.975), solve((l) => cdf(k, l), 0.025)];
}
// Wilson 95% interval on a share
function wilson(k, total) {
  const z = 1.96, p = k / total, d = 1 + (z * z) / total;
  const c = p + (z * z) / (2 * total), h = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [(c - h) / d, (c + h) / d];
}

const DIM = {
  pipe: { noun: "pipe", topic: "pipe" },
  channel: { noun: "channel", topic: "channel" },
  leg: { noun: "leg", topic: "leg" },
  workflow: { noun: "workflow", topic: "workflow" },
  strategy: { noun: "lead strategy", topic: "strategy" },
  tactic: { noun: "tactic", topic: "tactic" },
};

/**
 * Words for one outcome: o = { id, noun, nouns, emailsNoun, required, partialMonth, lastMonth }.
 */
function makeText(o) {
  const outcomesText = (k) => `${n(k)} ${k === 1 ? o.noun : o.nouns}`;
  const leadsText = (k) => `${n(k)} ${k === 1 ? "lead" : "leads"}`;
  return {
    roiNote: (r) => `${outcomesText(r.outcomes)} · ${n(r.emails)} ${o.emailsNoun}`,
    rateNote: (r) => `${n(r.reached)} of ${leadsText(r.leads)} went on to a ${o.noun}`,
    outcomesText,
    leadsText,
  };
}

function roiBars(o, rows, label) {
  const t = makeText(o);
  return rows
    .filter((r) => r.outcomes > 0)
    .sort((a, b) => a.spend / a.outcomes - b.spend / b.outcomes || b.outcomes - a.outcomes)
    .map((r) => ({ label: label(r.bucket), value: round2(r.spend / r.outcomes), display: usd(r.spend / r.outcomes), note: t.roiNote(r), thin: r.outcomes < o.required }));
}
const rateOf = (r) => (r.leads ? (r.reached / r.leads) * 100 : 0);
function rateBars(o, rows, label) {
  const t = makeText(o);
  return rows
    .filter((r) => r.leads > 0)
    .sort((a, b) => rateOf(b) - rateOf(a) || b.leads - a.leads)
    .map((r) => ({ label: label(r.bucket), value: round2(rateOf(r)), display: pct(rateOf(r)), note: t.rateNote(r), thin: r.reached < o.required }));
}

/** The month bars and the average since inception beside them, cost or rate, written here. */
function monthsChart(o, series, kind, subject, note) {
  const t = makeText(o);
  const tag = (ym) => (ym === o.partialMonth ? { partial: true } : {});
  const late = series.find((r) => r.bucket > o.lastMonth);
  if (late) throw new Error(`outcome ${o.id}: a month bar after the last cohort month (${late.bucket} > ${o.lastMonth}): re-run derive.mjs`);
  const points = series
    .filter((r) => (kind === "cost" ? r.outcomes > 0 : r.leads > 0))
    .map((r) => ({
      label: monthLabel(r.bucket),
      value: kind === "cost" ? round2(r.spend / r.outcomes) : round2(rateOf(r)),
      display: kind === "cost" ? usd(r.spend / r.outcomes) : pct(rateOf(r)),
      note: `${kind === "cost" ? t.roiNote(r) : t.rateNote(r)}${r.bucket === o.partialMonth ? ` · ${IN_PROGRESS}` : ""}`,
      thin: (kind === "cost" ? r.outcomes : r.reached) < o.required,
      ...tag(r.bucket),
    }));
  let spend = 0, got = 0, emails = 0, leads = 0, reached = 0;
  const cumulative = [];
  for (const r of series) {
    spend += r.spend; got += r.outcomes; emails += r.emails; leads += r.leads; reached += r.reached;
    if (kind === "cost" ? got === 0 : leads === 0) continue;
    const value = kind === "cost" ? spend / got : (reached / leads) * 100;
    cumulative.push({
      label: monthLabel(r.bucket),
      value: Number(value.toFixed(2)),
      display: kind === "cost" ? usd(value) : pct(value),
      note: `${kind === "cost" ? `${t.outcomesText(got)} · ${n(emails)} ${o.emailsNoun}` : `${n(reached)} of ${t.leadsText(leads)}`} to date${r.bucket === o.partialMonth ? ` · ${IN_PROGRESS}` : ""}`,
      thin: (kind === "cost" ? got : reached) < o.required,
      ...tag(r.bucket),
    });
  }
  return {
    kind: "months",
    title: kind === "cost" ? `${subject}: cost per ${o.noun} by month` : `${subject}: share of leads who went on to a ${o.noun}, by the month ${o.firstTouch ?? "we first wrote to"} them`,
    lowerIsBetter: kind === "cost",
    points,
    cumulative: { title: `${subject}: average since inception`, points: cumulative },
    note,
  };
}

const notMeasured = (id, o, cut, goal, topic, question, reason) => ({
  id, pipe: null, outcome: o.id, topic, goal, question,
  status: "not_enough_data", headline: "Not measured yet.", winner: null, crowned: false, result: null, charts: [],
  conclusion: [reason], verdict: { kind: "noise", reason },
});

function questionOf(o, cut, goal) {
  if (cut === "tactic") {
    return goal === "roi"
      ? `Which tactic makes a ${o.noun} cheaper when a workflow follows it?`
      : `Which tactic turns more leads into a ${o.noun} when a workflow follows it?`;
  }
  const d = DIM[cut].noun;
  return goal === "roi" ? `Which ${d} gets the cheapest ${o.noun}?` : `Which ${d} turns the most leads into a ${o.noun}?`;
}

/** One cut of one outcome on one goal: the bars, the winner, its verdict. */
function cutStudy(o, cut, goal, data, { label, population, note }) {
  const t = makeText(o);
  const dimNoun = DIM[cut].noun;
  const id = outcomeStudyId(o.id, cut, goal);
  const rows = data.rows;
  const bars = goal === "roi" ? roiBars(o, rows, label) : rateBars(o, rows, label);
  const drawn = rows.filter((r) => (goal === "roi" ? r.emails > 0 : r.leads > 0));
  const base = { id, pipe: null, outcome: o.id, topic: DIM[cut].topic, goal, question: questionOf(o, cut, goal) };
  const winnerRow = goal === "roi"
    ? [...drawn].filter((r) => r.outcomes > 0).sort((a, b) => a.spend / a.outcomes - b.spend / b.outcomes || b.outcomes - a.outcomes)[0]
    : [...drawn].filter((r) => r.reached > 0).sort((a, b) => rateOf(b) - rateOf(a) || b.leads - a.leads)[0];
  if (!winnerRow) {
    const headline = goal === "roi" ? `No ${dimNoun} has produced a ${o.noun} yet.` : `No ${dimNoun} has turned a lead into a ${o.noun} yet.`;
    return { ...base, status: "not_enough_data", headline, winner: null, crowned: false, result: null, charts: bars.length ? [{ kind: "bars", title: chartTitle(o, goal), lowerIsBetter: goal === "roi", points: bars, note }] : [], conclusion: [population], verdict: { kind: "noise", reason: headline } };
  }
  // the runner-up, in the order the chart draws them (an unpriced bucket after every priced one)
  const ordered = goal === "roi"
    ? [...drawn.filter((r) => r.outcomes > 0).sort((a, b) => a.spend / a.outcomes - b.spend / b.outcomes || b.outcomes - a.outcomes), ...drawn.filter((r) => r.outcomes === 0).sort((a, b) => b.spend - a.spend)]
    : [...drawn].sort((a, b) => rateOf(b) - rateOf(a) || b.leads - a.leads);
  const runner = ordered.find((r) => r !== winnerRow) ?? null;
  const side = (r) => (r ? (goal === "roi" ? { label: label(r.bucket), outcomes: r.outcomes, emails: r.emails, spend: r.spend } : { label: label(r.bucket), outcomes: r.reached, emails: r.leads, spend: r.spend }) : null);
  const strata = goal === "roi" ? data.roiStrata : data.rateStrata;
  const verdict = runner
    ? compareVerdict({
      a: side(winnerRow), b: side(runner), goal, comparisons: drawn.length - 1, count: "out",
      strata: { [label(winnerRow.bucket)]: strata[winnerRow.bucket], [label(runner.bucket)]: strata[runner.bucket] },
      noun: goal === "roi" ? o.noun : `lead who went on to a ${o.noun}`, nouns: goal === "roi" ? o.nouns : `leads who went on to a ${o.noun}`,
      ...(goal === "rate" ? { per: "per lead" } : {}),
    })
    : { kind: "noise", reason: `Only one ${dimNoun} reaches a ${o.noun} in this read: one figure, nothing to compare it with.` };
  const w = label(winnerRow.bucket);
  const figure = goal === "roi" ? `${usd(winnerRow.spend / winnerRow.outcomes)} per ${o.noun}` : `${pct(rateOf(winnerRow))} of leads going on to a ${o.noun}`;
  // one bucket ranks nothing: it states its figure and that nothing compares with it
  const headline = !runner
    ? `${w} is the only ${dimNoun} that reaches a ${o.noun} in this read: ${figure}, nothing to compare it with. Noise so far.`
    : headlineFor(goal === "roi" ? `${w} wins at ${figure}.` : `${w} wins with ${figure}.`, verdict.kind);
  return {
    ...base,
    status: "measured",
    headline,
    winner: w,
    crowned: verdict.kind === "conclusion",
    result: goal === "roi"
      ? { display: usd(winnerRow.spend / winnerRow.outcomes), unit: `per ${o.noun}`, sample: t.roiNote(winnerRow) }
      : { display: pct(rateOf(winnerRow)), unit: `of leads went on to a ${o.noun}`, sample: t.rateNote(winnerRow) },
    charts: [{ kind: "bars", title: chartTitle(o, goal), lowerIsBetter: goal === "roi", points: bars, note }],
    conclusion: [
      population,
      goal === "roi" ? `${w}: ${t.roiNote(winnerRow)}, ${usd(winnerRow.spend)} spent.` : `${w}: ${t.rateNote(winnerRow)}.`,
      `A ${dimNoun} with fewer than ${o.required} ${o.required === 1 ? o.noun : o.nouns} is ranked where its value puts it and marked Learning.`,
    ],
    verdict: { kind: verdict.kind, reason: verdict.reason },
  };
}
const chartTitle = (o, goal) => (goal === "roi" ? `Cost per ${o.noun} (USD, lower is better)` : `Leads who went on to a ${o.noun}, % (higher is better)`);

/**
 * The tactic cut: one bar per tactic, read on the emails whose workflow VERSION Jev judged to
 * follow it, its emails judged not to follow it stated beside. The verdict weighs the two sides
 * of the leading tactic (the better side first).
 */
function tacticStudy(o, goal, data, { tacticName, population, note }) {
  const t = makeText(o);
  const id = outcomeStudyId(o.id, "tactic", goal);
  const base = { id, pipe: null, outcome: o.id, topic: "tactic", goal, question: questionOf(o, "tactic", goal) };
  const byTactic = new Map();
  for (const r of data.rows) {
    const [tactic, sideKey] = r.bucket.split("|");
    if (!byTactic.has(tactic)) byTactic.set(tactic, {});
    byTactic.get(tactic)[sideKey] = r;
  }
  const value = (r) => (goal === "roi" ? (r && r.outcomes > 0 ? r.spend / r.outcomes : null) : r && r.leads > 0 ? rateOf(r) : null);
  const show = (r) => (goal === "roi" ? usd(r.spend / r.outcomes) : pct(rateOf(r)));
  const followed = [...byTactic.entries()].filter(([, s]) => s[YES] && (goal === "roi" ? s[YES].emails > 0 : s[YES].leads > 0));
  const nobody = [...byTactic.keys()].filter((k) => !followed.some(([f]) => f === k)).map(tacticName).sort();
  const sideNote = (r, word) => (r ? `${word}: ${value(r) === null ? "none yet" : show(r)}, ${goal === "roi" ? t.roiNote(r) : t.rateNote(r)}` : `${word}: no email`);
  const bars = followed
    .filter(([, s]) => value(s[YES]) !== null)
    .sort(([, a], [, b]) => (goal === "roi" ? value(a[YES]) - value(b[YES]) : value(b[YES]) - value(a[YES])))
    .map(([k, s]) => ({
      label: tacticName(k),
      value: round2(value(s[YES])),
      display: show(s[YES]),
      note: `${sideNote(s[YES], "Followed")} · ${sideNote(s[NO], "Not followed")}`,
      thin: (goal === "roi" ? s[YES].outcomes : s[YES].reached) < o.required,
    }));
  const lines = [
    population,
    ...(nobody.length ? [`No workflow in this population follows ${nobody.length === 1 ? "this tactic" : "these tactics"}: ${nobody.join(", ")}.`] : []),
  ];
  if (!bars.length) {
    const headline = `No tactic a workflow follows has ${goal === "roi" ? `produced a ${o.noun}` : `turned a lead into a ${o.noun}`} yet.`;
    return { ...base, status: "not_enough_data", headline, winner: null, crowned: false, result: null, charts: [], conclusion: lines, verdict: { kind: "noise", reason: headline } };
  }
  const leadKey = followed.find(([k]) => tacticName(k) === bars[0].label)[0];
  const sides = byTactic.get(leadKey);
  const yes = sides[YES], no = sides[NO];
  const name = tacticName(leadKey);
  const sideOf = (r, lbl) => (r ? (goal === "roi" ? { label: lbl, outcomes: r.outcomes, emails: r.emails, spend: r.spend } : { label: lbl, outcomes: r.reached, emails: r.leads, spend: r.spend }) : null);
  const yesLabel = `Following ${name}`, noLabel = `Not following ${name}`;
  const yesBetter = !no || value(no) === null || (goal === "roi" ? value(yes) <= value(no) : value(yes) >= value(no));
  const [a, b] = yesBetter ? [sideOf(yes, yesLabel), sideOf(no, lower(noLabel))] : [sideOf(no, noLabel), sideOf(yes, lower(yesLabel))];
  const strata = goal === "roi" ? data.roiStrata : data.rateStrata;
  const verdict = no
    ? compareVerdict({
      a, b, goal, comparisons: bars.length, count: "out",
      strata: { [a.label]: strata[`${leadKey}|${yesBetter ? YES : NO}`], [b.label]: strata[`${leadKey}|${yesBetter ? NO : YES}`] },
      noun: goal === "roi" ? o.noun : `lead who went on to a ${o.noun}`, nouns: goal === "roi" ? o.nouns : `leads who went on to a ${o.noun}`,
      ...(goal === "rate" ? { per: "per lead" } : {}),
    })
    : { kind: "noise", reason: `Every workflow in this population follows ${name}: nothing without it to compare with.` };
  const against = no && value(no) !== null ? `, against ${show(no)} when it does not` : no ? `; none yet when it does not` : "";
  const raw = goal === "roi"
    ? `${name} wins at ${show(yes)} per ${o.noun} when the workflow follows it${against}.`
    : `${name} wins with ${show(yes)} of leads going on to a ${o.noun} when the workflow follows it${against}.`;
  return {
    ...base,
    status: "measured",
    headline: headlineFor(raw, verdict.kind),
    winner: name,
    crowned: verdict.kind === "conclusion" && yesBetter,
    result: { display: show(yes), unit: goal === "roi" ? `per ${o.noun}, workflows following it` : `of leads went on to a ${o.noun}, workflows following it`, sample: goal === "roi" ? t.roiNote(yes) : t.rateNote(yes) },
    charts: [{ kind: "bars", title: goal === "roi" ? `Cost per ${o.noun} when the workflow follows the tactic (USD, lower is better)` : `Leads who went on to a ${o.noun} when the workflow follows the tactic, % (higher is better)`, lowerIsBetter: goal === "roi", points: bars, note }],
    conclusion: [
      ...lines,
      `${name}: ${sideNote(yes, "followed")}; ${sideNote(no, "not followed")}.`,
      ...(yesBetter ? [] : [`Workflows that do not follow ${name} do better here: its bar leads the tactics, but following it is not what makes it lead.`]),
    ],
    verdict: { kind: verdict.kind, reason: verdict.reason },
  };
}

/**
 * A pipe, channel or leg cut of an outcome's COST (owner 2026-10-18): every pipe whose spend is in
 * the outcome's average gets one bar, its spend over EVERY outcome, so the bars add up to the
 * average a reader sees overall. Never a pipe's spend over its own outcomes: on Meeting booked that
 * read $17 beside a $584 average under the same label. A decomposition ranks nothing, so its
 * verdict is the average's own.
 */
function decompStudy(o, cut, data, { label, population, note, total, verdict }) {
  const t = makeText(o);
  const dimNoun = DIM[cut].noun;
  const base = { id: outcomeStudyId(o.id, cut, "roi"), pipe: null, outcome: o.id, topic: DIM[cut].topic, goal: "roi", question: `What does each ${dimNoun} add to the cost of a ${o.noun}?` };
  const rows = data.rows.filter((r) => r.spend > 0);
  if (!total.outcomes || !rows.length) {
    const headline = `No ${o.noun} to price yet.`;
    return { ...base, status: "not_enough_data", headline, winner: null, winnerLabel: "Largest share", crowned: false, result: null, charts: [], conclusion: [population], verdict: { kind: "noise", reason: headline } };
  }
  const avg = total.spend / total.outcomes;
  const bars = rows
    .map((r) => ({ label: label(r.bucket), value: round2(r.spend / total.outcomes), display: usd(r.spend / total.outcomes), note: `${usd(r.spend)} spent, ${shareText(r.spend / total.spend)} of the cost`, thin: total.outcomes < o.required }))
    .sort((a, b) => b.value - a.value);
  const raw = bars.length === 1
    ? `${bars[0].label} carries the whole cost: ${usd(avg)} per ${o.noun}.`
    : `${usd(avg)} per ${o.noun} in all: ${bars.map((b) => `${b.label} ${b.display}`).join(", ")}.`;
  const suffix = verdict.kind === "conclusion" ? "" : verdict.kind === "signal" ? " A signal to confirm, not yet a conclusion." : " Noise so far.";
  return {
    ...base,
    status: "measured",
    headline: `${raw}${suffix}`,
    winner: bars[0].label,
    winnerLabel: "Largest share",
    crowned: verdict.kind === "conclusion",
    result: { display: usd(avg), unit: `per ${o.noun}, every ${dimNoun} added up`, sample: `${t.outcomesText(total.outcomes)} · ${usd(total.spend)} spent` },
    charts: [{
      kind: "bars",
      title: `What each ${dimNoun} adds to the cost of a ${o.noun} (USD)`,
      lowerIsBetter: true,
      points: bars,
      note: `Each bar is that ${dimNoun}'s spend over every ${o.noun} (${n(total.outcomes)}), so the bars add up to the ${usd(avg)} average. ${note}`,
    }],
    conclusion: [population, `The bars split the ${usd(avg)} a ${o.noun} costs by where the money went: ${usd(total.spend)} over ${t.outcomesText(total.outcomes)}.`],
    verdict: { kind: verdict.kind, reason: verdict.reason },
  };
}
// a share in whole percent; a sliver never reads 0%, nor a near-whole 100%
const shareText = (x) => (x >= 1 ? "100%" : x > 0.995 ? ">99%" : x > 0 && x < 0.005 ? "<1%" : `${Math.round(x * 100)}%`);
/** The one line a pipe, channel or leg RATE chart states: each bar is its own leads. */
const rateCutNote = (o, cut, note) => `Each bar is the share of the leads that entered that ${DIM[cut].noun} who went on to a ${o.noun}. ${note}`;

function overallStudies(o, entry, { pipesText, population, note }) {
  const t = makeText(o);
  const series = entry.byMonth;
  const tot = series.reduce((a, r) => ({ emails: a.emails + r.emails, spend: a.spend + r.spend, outcomes: a.outcomes + r.outcomes, leads: a.leads + r.leads, reached: a.reached + r.reached }), { emails: 0, spend: 0, outcomes: 0, leads: 0, reached: 0 });
  const out = [];
  {
    const chart = monthsChart(o, series, "cost", "Every pipe landing on it", note);
    const all = chart.cumulative.points[chart.cumulative.points.length - 1] ?? null;
    const [lo, hi] = poissonInterval(tot.outcomes);
    const verdict = !all
      ? { kind: "noise", reason: `No ${o.noun} yet.` }
      : tot.outcomes < o.required
        ? { kind: "noise", reason: `Learning: ${t.outcomesText(tot.outcomes)} of the ${n(o.required)} a figure needs.` }
        : tot.outcomes >= MIN_OUTCOMES
        ? { kind: "conclusion", reason: `A measurement on ${t.outcomesText(tot.outcomes)}: 95% interval ${usd(tot.spend / hi)} to ${usd(tot.spend / lo)} per ${o.noun}.` }
        : { kind: "noise", reason: `Only ${t.outcomesText(tot.outcomes)} so far.` };
    const headline = all ? `${all.display} per ${o.noun} on average since inception, across ${pipesText}.` : `Not enough ${o.nouns} to state an average yet.`;
    out.push({
      id: outcomeStudyId(o.id, "overall", "roi"), pipe: null, outcome: o.id, topic: "cost", goal: "roi",
      question: `What does a ${o.noun} cost on average, across every pipe that lands on it?`,
      status: all ? "measured" : "not_enough_data",
      headline: all && verdict.kind !== "conclusion" ? `${headline} Noise so far.` : headline,
      winner: null, crowned: verdict.kind === "conclusion",
      result: all ? { display: all.display, unit: `per ${o.noun}, average since inception`, sample: all.note.replace(` · ${IN_PROGRESS}`, "") } : null,
      charts: all ? [chart] : [],
      conclusion: [population, `The average divides everything spent since the first email by every ${o.noun} since; the monthly bars are context, not the answer.`],
      verdict,
    });
  }
  {
    const chart = monthsChart(o, series, "rate", "Every pipe landing on it", note);
    const all = tot.leads > 0 ? rateOf(tot) : null;
    const verdict = all === null || tot.reached === 0
      ? { kind: "noise", reason: `No lead has gone on to a ${o.noun} yet.` }
      : tot.reached < o.required
        ? { kind: "noise", reason: `Learning: ${n(tot.reached)} ${tot.reached === 1 ? "lead" : "leads"} went on to a ${o.noun}, of the ${n(o.required)} a figure needs.` }
        : tot.reached >= MIN_OUTCOMES
        ? (() => { const [lo, hi] = wilson(tot.reached, tot.leads); return { kind: "conclusion", reason: `A measurement on ${n(tot.reached)} of ${t.leadsText(tot.leads)}: 95% interval ${pct(lo * 100)} to ${pct(hi * 100)}.` }; })()
        : { kind: "noise", reason: `Only ${n(tot.reached)} ${tot.reached === 1 ? "lead" : "leads"} went on to a ${o.noun} so far.` };
    const headline = all !== null ? `${pct(all)} of leads went on to a ${o.noun} since inception, across ${pipesText}.` : `No lead written to yet.`;
    out.push({
      id: outcomeStudyId(o.id, "overall", "rate"), pipe: null, outcome: o.id, topic: "conversion", goal: "rate",
      question: `What share of leads goes on to a ${o.noun}?`,
      status: all !== null && tot.reached > 0 ? "measured" : "not_enough_data",
      headline: all !== null && tot.reached > 0 && verdict.kind !== "conclusion" ? `${headline} Noise so far.` : headline,
      winner: null, crowned: verdict.kind === "conclusion",
      result: all !== null ? { display: pct(all), unit: `of leads went on to a ${o.noun}, since inception`, sample: `${n(tot.reached)} of ${t.leadsText(tot.leads)}` } : null,
      charts: all !== null ? [chart] : [],
      conclusion: [population, `A lead counts once, however many emails it got and on however many campaigns: lead-service's own lead, a person at a company. Each lead sits in the month ${o.firstTouch ?? "we first wrote to"} it.`],
      verdict,
    });
  }
  return out;
}

/**
 * The studies of one email outcome (Positive reply, Website visit).
 * entry: one outcomeCuts() entry. o: { id, noun, nouns, emailsNoun, required, partialMonth, lastMonth }.
 * words: { pipeName(pipe), channelName(slug), legName(leg), workflowLabel(dynasty), strategyLabel(id), tacticName(id) }.
 * text: { note (the maturity rule line), visitLine (null, or what a website visit is),
 *   strategyRecordedFrom, costBasis }.
 */
export function emailOutcomeStudies(o, entry, words, text) {
  const t = makeText(o);
  const sc = entry.scope;
  const pipeNames = entry.pipes.map((p) => words.pipeName(p.pipe));
  const pipesText = pipeNames.length === 1 ? `the one pipe that lands on it (${pipeNames[0]})` : `${pipeNames.length} pipes (${pipeNames.join(", ")})`;
  const who = `Population: the ${n(sc.emails)} ${o.emailsNoun} of ${pipeNames.length === 1 ? `the one pipe that lands on a ${o.noun}, ${pipeNames[0]},` : `the ${pipeNames.length} pipes that land on a ${o.noun} (${pipeNames.join(", ")})`} to ${t.leadsText(sc.leads)}, across ${n(sc.orgs)} clients.${sc.noLead ? ` ${n(sc.noLead)} ${o.emailsNoun} carry no lead record: in the costs, out of the rates.` : ""}${text.visitLine ? ` ${text.visitLine}` : ""}`;
  const studies = [...overallStudies(o, entry, { pipesText, population: who, note: text.note })];
  const average = studies[0];
  const total = entry.byMonth.reduce((a, r) => ({ spend: a.spend + r.spend, outcomes: a.outcomes + r.outcomes }), { spend: 0, outcomes: 0 });
  const labels = {
    pipe: words.pipeName,
    channel: words.channelName,
    leg: words.legName,
    workflow: words.workflowLabel,
    strategy: words.strategyLabel,
  };
  const strategyLine = text.strategyRecordedFrom
    ? `A run's lead strategy is recorded since ${dayText(text.strategyRecordedFrom)}: the ${n(sc.unattributed)} ${o.emailsNoun} that carry no record (every email before that day) are left out, never counted under the default${sc.noPlay ? `, and so are the ${n(sc.noPlay)} whose run was served under no strategy` : ""}.`
    : `No run's lead strategy was recorded yet: the ${n(sc.unattributed)} ${o.emailsNoun} that carry no record are left out, never counted under the default.`;
  const tacticLine = `Each email is filed under its workflow version's verdicts: Jev judges every version against each tactic's text, and re-judges it in place when that text changes, so this reads today's judgment. ${sc.unjudged ? `${n(sc.unjudged)} ${o.emailsNoun} whose version carries no verdict are left out.` : "Every version here carries one."}`;
  for (const cut of CUTS) {
    for (const goal of ["roi", "rate"]) {
      const population = cut === "strategy" ? `${who} ${strategyLine}` : cut === "tactic" ? `${who} ${tacticLine}` : who;
      if (cut === "tactic") studies.push(tacticStudy(o, goal, entry.cuts.tactic, { tacticName: words.tacticName, population, note: text.note }));
      else if (SPLIT.has(cut) && goal === "roi") studies.push(decompStudy(o, cut, entry.cuts[cut], { label: labels[cut], population, note: text.note, total, verdict: average.verdict }));
      else studies.push(cutStudy(o, cut, goal, entry.cuts[cut], { label: labels[cut], population, note: SPLIT.has(cut) ? rateCutNote(o, cut, text.note) : text.note }));
    }
  }
  return studies;
}

/**
 * The Meeting booked row's counts, in the shape outcomeCuts writes for an email outcome, on the
 * population meeting-cost prices (the brands that report their meetings):
 *  - read: meetings.mjs `outcomeRead` (spend per pipe, the credited meetings, the leads the meeting
 *    booking leg acted on with the run that acted);
 *  - emailLeads: derive.mjs `meetingEmailLeads`, per cold email pipe (`<channel>|<leg>`) the leads it
 *    wrote to there with their first email;
 *  - runs: every meeting booking execute-workflow run (run_id, workflow_slug, campaign_id, cents);
 *  - dynastyOf: version -> dynasty; brandOfCampaign: campaign -> brand; verdicts: version -> tactic
 *    -> yes/no; strategyOf(runId) -> { id } (strategy.mjs).
 * A lead entered a pipe when it wrote to it (cold email) or acted on it (meeting booking); it
 * reached the outcome when a credited meeting was booked on or after that. Leads at lead-service's
 * grain: one lead counts once per bucket.
 */
export function meetingOutcomeEntry({ read, emailLeads, runs, dynastyOf, brandOfCampaign, verdicts, strategyOf, step, meetingPipe }) {
  const reporting = new Set(read.reporting);
  const meetingsByLead = new Map();
  for (const m of read.meetings) {
    if (!m.lead) continue;
    if (!meetingsByLead.has(m.lead)) meetingsByLead.set(m.lead, []);
    meetingsByLead.get(m.lead).push(m.at);
  }
  const meetingsAfter = (lead, at) => (meetingsByLead.get(lead) || []).filter((x) => x >= at).length;
  // every pipe: its spend and the leads that entered it
  const pipes = new Map();
  const pipeOf = (k) => pipes.get(k) || pipes.set(k, { spend: 0, leads: new Map() }).get(k);
  for (const s of read.spendByPipe) pipeOf(`${s.channel}|${s.leg}`).spend += s.spend;
  for (const [k, list] of Object.entries(emailLeads)) {
    const p = pipeOf(k);
    for (const [lead, at] of list) if (!p.leads.has(lead) || at < p.leads.get(lead)) p.leads.set(lead, at);
  }
  const booking = pipeOf(meetingPipe);
  for (const a of read.acted) if (!booking.leads.has(a.lead) || a.at < booking.leads.get(a.lead)) booking.leads.set(a.lead, a.at);
  const rowOf = (bucket, spend, leads) => {
    let reached = 0, outcomes = 0;
    for (const [lead, at] of leads) {
      const k = meetingsAfter(lead, at);
      if (k) { reached++; outcomes += k; }
    }
    return { bucket, emails: leads.size, spend: round2(spend), outcomes, leads: leads.size, reached };
  };
  const group = (keyOf) => {
    const g = new Map();
    for (const [k, p] of pipes) {
      const gk = keyOf(k);
      const x = g.get(gk) || g.set(gk, { spend: 0, leads: new Map() }).get(gk);
      x.spend += p.spend;
      for (const [lead, at] of p.leads) if (!x.leads.has(lead) || at < x.leads.get(lead)) x.leads.set(lead, at);
    }
    return { rows: [...g.keys()].sort().map((k) => rowOf(k, g.get(k).spend, g.get(k).leads)), roiStrata: {}, rateStrata: {} };
  };
  const all = group(() => "all").rows[0] ?? null;
  // the month each lead first entered any pipe, for the overall rate
  const first = new Map();
  for (const p of pipes.values()) for (const [lead, at] of p.leads) if (!first.has(lead) || at < first.get(lead)) first.set(lead, at);
  const months = new Map();
  for (const [lead, at] of first) {
    const m = months.get(at.slice(0, 7)) || months.set(at.slice(0, 7), { leads: 0, reached: 0 }).get(at.slice(0, 7));
    m.leads++;
    if (meetingsAfter(lead, at)) m.reached++;
  }
  // the meeting booking leg's leads, by the workflow version of the run that acted on them
  const runById = new Map(runs.map((r) => [r.run_id, r]));
  const inPop = (r) => reporting.has(brandOfCampaign.get(r.campaign_id));
  let noRun = 0, noDynasty = 0;
  const filed = { workflow: new Map(), tactic: new Map(), strategy: new Map() };
  const put = (cut, key, lead, at) => {
    const x = filed[cut].get(key) || filed[cut].set(key, { spend: 0, leads: new Map() }).get(key);
    if (lead && (!x.leads.has(lead) || at < x.leads.get(lead))) x.leads.set(lead, at);
    return x;
  };
  const keysOf = (run) => {
    const out = [];
    const dyn = dynastyOf.get(run.workflow_slug);
    if (dyn) out.push(["workflow", dyn]);
    for (const [t, yes] of verdicts.get(run.workflow_slug) || []) out.push(["tactic", `${t}|${yes ? YES : NO}`]);
    const st = strategyOf(run.run_id);
    if (st?.id) out.push(["strategy", st.id]);
    return out;
  };
  for (const a of read.acted) {
    const run = a.runId ? runById.get(a.runId) : null;
    if (!run) { noRun++; continue; }
    if (!dynastyOf.get(run.workflow_slug)) noDynasty++;
    for (const [cut, key] of keysOf(run)) put(cut, key, a.lead, a.at);
  }
  for (const r of runs) {
    if (!inPop(r)) continue;
    for (const [cut, key] of keysOf(r)) put(cut, key, null, null).spend += Number(r.cents) / 100;
  }
  const cutOf = (cut) => ({ rows: [...filed[cut].keys()].sort().map((k) => rowOf(k, filed[cut].get(k).spend, filed[cut].get(k).leads)), roiStrata: {}, rateStrata: {} });
  return {
    step,
    pipes: [...pipes.keys()].sort(),
    scope: {
      leads: first.size,
      meetings: read.meetings.length,
      meetingsNoLead: read.meetings.filter((m) => !m.lead).length,
      acted: read.acted.length,
      actedNoRun: noRun,
      actedNoDynasty: noDynasty,
      reached: all ? all.reached : 0,
    },
    byMonth: [...months.keys()].sort().map((bucket) => ({ bucket, emails: months.get(bucket).leads, spend: 0, outcomes: 0, leads: months.get(bucket).leads, reached: months.get(bucket).reached })),
    cuts: {
      pipe: group((k) => k),
      channel: group((k) => k.split("|")[0]),
      leg: group((k) => k.split("|")[1]),
      workflow: cutOf("workflow"),
      strategy: cutOf("strategy"),
      tactic: cutOf("tactic"),
    },
    total: { spend: read.totalSpend, outcomes: read.meetings.length },
  };
}

/**
 * The studies of the Meeting booked row beside the two meeting studies meetings.mjs writes
 * (meeting-cost is its average since inception, and its verdict is the cost split's).
 * words: { pipeLabel(`<channel>|<leg>`), channelName, legName, workflowLabel(dynasty), strategyLabel, tacticName }.
 */
export function meetingOutcomeStudies(o, entry, words, { costBasis, verdict, strategyRecordedFrom }) {
  const t = makeText(o);
  const sc = entry.scope;
  const note = `A meeting counts when it was booked on or after the lead entered that pipe, and our outreach gets the credit for it. A figure needs ${o.required} ${o.required === 1 ? "meeting" : "meetings"} behind it; below that it reads Learning.`;
  const population = `Population: the brands that report their booked meetings, as the average since inception prices them: every dollar charged there on cold email and meeting booking (${usd(entry.total.spend)}), the ${n(sc.meetings)} ${sc.meetings === 1 ? "meeting" : "meetings"} our outreach gets the credit for${sc.meetingsNoLead ? ` (${n(sc.meetingsNoLead)} name no lead, so they reach no rate)` : ""}, and the ${t.leadsText(sc.leads)} our pipes wrote to or acted on there.`;
  const runLine = `The meeting booking step's leads are filed under the run that acted on them (its workflow version, Jev's verdicts on that version, the lead strategy it was served under) and its spend under the same runs.${sc.actedNoRun ? ` ${n(sc.actedNoRun)} of the ${n(sc.acted)} leads it acted on carry no such run and are left out.` : ""}${sc.actedNoDynasty ? ` ${n(sc.actedNoDynasty)} more were acted on by a version workflow-service files under no workflow: out of the workflow cut.` : ""}`;
  const strategyLine = strategyRecordedFrom ? ` A run's lead strategy is recorded since ${dayText(strategyRecordedFrom)}: earlier runs carry none and are left out, never counted under the default.` : "";
  const notBilled = (cut, goal) => notMeasured(outcomeStudyId(o.id, cut, goal), o, cut, goal, DIM[cut].topic, questionOf(o, cut, goal), "The meeting figures are on what clients were charged only. Switch to the billed basis to read them.");
  const labels = { pipe: words.pipeLabel, channel: words.channelName, leg: words.legName, workflow: words.workflowLabel, strategy: words.strategyLabel };
  const studies = overallStudies(o, entry, { pipesText: "every pipe on the brands that report their meetings", population, note }).filter((x) => x.goal === "rate");
  for (const cut of CUTS) {
    for (const goal of ["roi", "rate"]) {
      if (goal === "roi" && costBasis === "actual") { studies.push(notBilled(cut, goal)); continue; }
      const pop = SPLIT.has(cut) ? population : `${population} ${runLine}${cut === "strategy" ? strategyLine : ""}`;
      if (cut === "tactic") studies.push(tacticStudy(o, goal, entry.cuts.tactic, { tacticName: words.tacticName, population: pop, note }));
      else if (SPLIT.has(cut) && goal === "roi") studies.push(decompStudy(o, cut, entry.cuts[cut], { label: labels[cut], population: pop, note, total: entry.total, verdict }));
      else studies.push(cutStudy(o, cut, goal, entry.cuts[cut], { label: labels[cut], population: pop, note: SPLIT.has(cut) ? rateCutNote(o, cut, note) : note }));
    }
  }
  return studies;
}
