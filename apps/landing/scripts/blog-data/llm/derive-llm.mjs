#!/usr/bin/env node
// Writes the committed snapshot the article `best-llm-for-cold-email` is rendered from.
//
//   node derive-llm.mjs <facts.json> > llm.snapshot.json
//
// Reads the same facts.json the Research page is built from (derive.mjs `tierStrata`,
// `tierStepStrata`, `modelStrata`) and keeps, per leg, only the strata BOTH arms ran in: Flash
// against Pro on the same client in the same month, and each Flash model against the Pro model
// that wrote the most emails. Each stratum is a bare pair of counts: no org, no month, no lead, no
// campaign, so the committed file names nobody. like-for-like.mjs pools them, for the article
// exactly as for the Research page.
import { readFileSync } from "node:fs";
import { sharedPairs } from "../like-for-like.mjs";

const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: derive-llm.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
const R = facts.research;
const M = facts.researchMaturity;
for (const k of ["reply", "visit"]) {
  if (!R?.[k]?.tierStrata || !R[k].tierStepStrata || !R[k].modelStrata) throw new Error(`facts.json carries no ${k} strata: re-run derive.mjs`);
}
if (!M?.legs?.reply || !M?.legs?.visit) throw new Error("facts.json carries no researchMaturity: re-run derive.mjs");

const COUNT = { reply: "replies", visit: "clicks" };
// a pair is [Flash or the named model, the Pro reference], each [emails, outcomes, spend]
const flat = (pairs) =>
  pairs
    .map(([a, b]) => [[a.emails, a.outcomes, Math.round(a.spend * 100) / 100], [b.emails, b.outcomes, Math.round(b.spend * 100) / 100]])
    .sort((p, q) => q[0][0] + q[1][0] - (p[0][0] + p[1][0]));
const totals = (strata) =>
  Object.values(strata || {}).reduce((t, s) => ({ emails: t.emails + s.emails, clicks: t.clicks + s.clicks, replies: t.replies + s.replies }), { emails: 0, clicks: 0, replies: 0 });

function leg(key) {
  const o = R[key];
  const m = M.legs[key];
  const count = COUNT[key];
  // the Pro model that wrote the most emails on this leg is the one every Flash model is held to
  const tierOf = Object.fromEntries((o.byModel || []).map((r) => [r.bucket, / Pro$/.test(r.bucket) ? "Pro" : / Flash/.test(r.bucket) ? "Flash" : null]));
  const sized = Object.entries(o.modelStrata).map(([label, s]) => ({ label, tier: tierOf[label], ...totals(s) }));
  const reference = sized.filter((x) => x.tier === "Pro").sort((a, b) => b.emails - a.emails)[0];
  if (!reference) throw new Error(`${key}: no Pro model`);
  const models = sized
    .filter((x) => x.tier === "Flash")
    .map((x) => ({ label: x.label, pairs: flat(sharedPairs(o.modelStrata[x.label], o.modelStrata[reference.label], count)) }))
    .filter((x) => x.pairs.length)
    .sort((a, b) => b.pairs.reduce((t, p) => t + p[0][0], 0) - a.pairs.reduce((t, p) => t + p[0][0], 0));
  return {
    legKey: m.legKey,
    durationDays: m.durationDays,
    cutoff: m.cutoff,
    count,
    all: { Flash: totals(o.tierStrata.Flash), Pro: totals(o.tierStrata.Pro) },
    tier: flat(sharedPairs(o.tierStrata.Flash, o.tierStrata.Pro, count)),
    tierStep: flat(sharedPairs(o.tierStepStrata.Flash, o.tierStepStrata.Pro, count)),
    reference: reference.label,
    // every Pro model that wrote on this leg, largest first, so the copy can name a lone one
    proModels: sized.filter((x) => x.tier === "Pro").sort((a, b) => b.emails - a.emails).map((x) => x.label),
    models,
  };
}

const snapshot = {
  windowFrom: facts.window.from,
  readOn: facts.generatedAt.slice(0, 10),
  windowEnd: M.windowEnd,
  visit: leg("visit"),
  reply: leg("reply"),
  crmRepliesAdded: R.crmReplies?.added ?? 0,
};
process.stdout.write(`${JSON.stringify(snapshot)}\n`);
