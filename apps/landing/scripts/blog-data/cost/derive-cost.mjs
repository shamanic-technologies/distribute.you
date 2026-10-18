#!/usr/bin/env node
// Writes the committed snapshot the article `cold-email-cost-per-positive-reply` is rendered from.
//
//   node derive-cost.mjs <live research file> > cost.snapshot.json
//
// Reads the Research page's LIVE file (features-service GET /internal/research?basis=user, saved to
// disk as the blog-data README says) and copies out its two average-cost studies, word for word and figure for figure:
// what a positive reply cost (`cold-email-positive-reply-cost-over-time`) and what a website visit cost
// (`cold-email-website-visit-cost-over-time`), each with its months, its average since inception, and the 95% interval
// features-service printed in its verdict. Nothing is re-derived here, so the article and the Research
// page state the same figures for one read. Aggregates only: no text, no client, no lead.
import { readFileSync } from "node:fs";

const researchPath = process.argv[2];
if (!researchPath) throw new Error("usage: derive-cost.mjs <live research file>");
const R = JSON.parse(readFileSync(researchPath, "utf8"));
if (R.costBasis !== "user") throw new Error(`the research file is on the ${R.costBasis} cost basis: the article states what clients paid (user)`);
if (R.allOrgs !== true) throw new Error("the research file is not fleet-wide");

function study(id) {
  const s = R.studies.find((x) => x.id === id);
  if (!s) throw new Error(`the research file carries no ${id}`);
  if (s.status !== "measured") throw new Error(`${id} is ${s.status}, not measured`);
  if (s.verdict?.kind !== "conclusion") throw new Error(`${id} is a ${s.verdict?.kind}, not a conclusion: nothing to publish`);
  // the interval lives in the verdict's reason, as features-service wrote it (Poisson on the outcomes)
  const ci = s.verdict.reason.match(/^A measurement on ([\d,]+) [a-z ]+: 95% interval \$([\d.,]+) to \$([\d.,]+) per /);
  if (!ci) throw new Error(`${id}: cannot read the interval in "${s.verdict.reason}"`);
  const chart = s.charts.find((c) => c.kind === "months");
  if (!chart?.cumulative) throw new Error(`${id}: no month chart with its running average`);
  const sample = s.result.sample.match(/^([\d,]+) [a-z ]+ · ([\d,]+) emails/);
  if (!sample) throw new Error(`${id}: cannot read the sample "${s.result.sample}"`);
  const num = (x) => Number(String(x).replace(/,/g, ""));
  // `partial`: the month the maturity cutoff falls inside, drawn dotted (features-service sets it)
  const pts = (ps) => ps.map((p) => ({ label: p.label, value: p.value, display: p.display, note: p.note, thin: p.thin, partial: p.partial === true }));
  return {
    id,
    average: { value: chart.cumulative.points.at(-1).value, display: s.result.display },
    outcomes: num(sample[1]),
    emails: num(sample[2]),
    interval: { lo: num(ci[2]), hi: num(ci[3]) },
    months: pts(chart.points),
    running: pts(chart.cumulative.points),
  };
}

const snapshot = {
  generatedAt: R.generatedAt,
  readOn: R.readOn,
  windowFrom: R.window.from,
  durationDays: R.maturation.legs.reply.durationDays,
  cutoff: R.maturation.legs.reply.cutoff,
  reply: study("cold-email-positive-reply-cost-over-time"),
  visit: study("cold-email-website-visit-cost-over-time"),
};
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
