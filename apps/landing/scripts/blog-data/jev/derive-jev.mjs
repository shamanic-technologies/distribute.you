#!/usr/bin/env node
// Writes the committed snapshot the article `gtm-ai-llm-judge` is rendered from.
//
//   node derive-jev.mjs <research.json> > jev.snapshot.json
//
// Reads the Research page's own snapshot (apps/dashboard/src/lib/research/research.json, written by
// research.mjs + jev.mjs) and copies out its four Typed judgment studies, figure for figure. Nothing
// is re-derived here, so the article and the Research page state the same figures for one refresh.
// It refuses a study that is not a conclusion: noise is never published. Aggregates only.
import { readFileSync } from "node:fs";

const researchPath = process.argv[2];
if (!researchPath) throw new Error("usage: derive-jev.mjs <research.json>");
const R = JSON.parse(readFileSync(researchPath, "utf8"));
if (R.costBasis !== "user") throw new Error(`research.json is on the ${R.costBasis} cost basis: the article states what clients were billed (user)`);
if (R.allOrgs !== true) throw new Error("research.json is not fleet-wide");

function study(id) {
  const s = R.studies.find((x) => x.id === id);
  if (!s) throw new Error(`research.json carries no ${id}`);
  if (s.status !== "measured") throw new Error(`${id} is ${s.status}, not measured`);
  if (s.verdict?.kind !== "conclusion") throw new Error(`${id} is a ${s.verdict?.kind}, not a conclusion: nothing to publish`);
  return s;
}
const match = (id, text, re) => {
  const m = String(text).match(re);
  if (!m) throw new Error(`${id}: cannot read ${re} in "${text}"`);
  return m;
};
const num = (x) => Number(String(x).replace(/[,$x%]/g, ""));
const bars = (c) => c.points.map((p) => ({ label: p.label, value: p.value, display: p.display, note: p.note, partial: p.partial === true }));

const v = study("jev-volume");
const vs = match(v.id, v.result.sample, /^([\d,]+)M input tokens · (\$[\d.]+) per 1,000 judgments billed/);
const d = study("jev-screen-decline");
const ds = match(d.id, d.result.sample, /^([\d,]+) of ([\d,]+) people · ([\d,]+) audiences · ([\d,]+) clients$/);
const dci = match(d.id, d.conclusion[0], /95% interval (\d+)% to (\d+)%/);
const dsure = match(d.id, d.conclusion[1], /\((\d+)%\)/);
const dold = match(d.id, d.conclusion[2], /([\d,]+) people between 50% and 80%/);
const p = study("jev-screen-price");
const ps = match(p.id, p.result.sample, /^(\$[\d.]+) per 1,000 screens · (\$[\d.]+) per reveal · ([\d,]+) screens, ([\d,]+) reveals$/);
const m = study("jev-machine-replies");
const ms = match(m.id, m.result.sample, /^([\d,]+) of ([\d,]+) replies$/);
const mci = match(m.id, m.conclusion[0], /95% interval (\d+)% to (\d+)%/);
const total = num(v.result.display);

const snapshot = {
  generatedAt: R.generatedAt,
  readOn: R.readOn,
  volume: {
    display: v.result.display,
    // a marketing volume is rounded hard, down to the 10,000 (blog-article skill)
    rounded: `${Math.floor(total / 10000) * 10}k+`,
    tokensM: vs[1],
    perThousand: vs[2],
    months: bars(v.charts[0]),
    askers: bars(v.charts[1]),
    clients: num(match(v.id, v.verdict.reason, /across ([\d,]+) clients/)[1]),
  },
  screen: {
    display: d.result.display,
    declined: num(ds[1]),
    people: num(ds[2]),
    audiences: num(ds[3]),
    clients: num(ds[4]),
    ciLo: `${dci[1]}%`,
    ciHi: `${dci[2]}%`,
    sure: `${dsure[1]}%`,
    oldBarLost: num(dold[1]),
    buckets: bars(d.charts[0]),
  },
  price: { display: p.result.display, screenPerThousand: ps[1], reveal: ps[2], screens: num(ps[3]), reveals: num(ps[4]) },
  machine: { display: m.result.display, machine: num(ms[1]), replies: num(ms[2]), ciLo: `${mci[1]}%`, ciHi: `${mci[2]}%`, kinds: bars(m.charts[0]) },
};
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
