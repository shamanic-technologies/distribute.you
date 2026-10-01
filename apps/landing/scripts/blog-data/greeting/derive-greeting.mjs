#!/usr/bin/env node
// Writes the committed snapshot the article `cold-email-greeting` is rendered from.
//
//   node derive-greeting.mjs <facts.json> > greeting.snapshot.json
//
// Reads the same facts.json the Research page is built from and copies out the two opening
// studies research.mjs states (`scout-opening-roi` for website visits, `herald-opening-roi` for
// positive replies): every email of a sequence filed under how its FIRST email opens
// (first-email-shape.mjs `openingOf`, a regex, no model), all tiers and per tier. So the article
// and the Research page state the same figures for one extract. Aggregates only: no text, no
// client, no lead, no campaign.
import { readFileSync } from "node:fs";

const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: derive-greeting.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
const R = facts.research;
const M = facts.researchMaturity;
if (!R?.reply?.byOpening || !R?.visit?.byOpening) throw new Error("facts.json carries no opening cut: re-run derive.mjs");
if (!M?.legs?.reply || !M?.legs?.visit) throw new Error("facts.json carries no researchMaturity: re-run derive.mjs");

const COUNT = { reply: "replies", visit: "clicks" };
const bucket = (key) => (r) => ({ bucket: r.bucket, emails: r.emails, [COUNT[key]]: r[COUNT[key]], spend: r.spend });
const leg = (key) => {
  const o = R[key];
  const m = M.legs[key];
  return {
    legKey: m.legKey,
    durationDays: m.durationDays,
    outcomesRequired: m.outcomesRequired,
    cutoff: m.cutoff,
    all: o.byOpening.map(bucket(key)),
    tiers: Object.fromEntries(["Flash", "Pro"].map((t) => [t, (o.openingByTier[t] || []).map(bucket(key))])),
    noOpening: o.firstShape.noOpening,
    lastMonth: o.firstShape.lastMonth,
  };
};

const snapshot = {
  windowFrom: facts.window.from,
  readOn: facts.generatedAt.slice(0, 10),
  windowEnd: M.windowEnd,
  visit: leg("visit"),
  reply: leg("reply"),
  crmRepliesAdded: R.crmReplies?.added ?? 0,
};
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
