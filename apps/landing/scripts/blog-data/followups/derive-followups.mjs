#!/usr/bin/env node
// Writes the committed snapshot the article `cold-email-follow-up` is rendered from.
//
//   node derive-followups.mjs <facts.json> > followups.snapshot.json
//
// Reads the same facts.json the Research page is built from and copies out the follow-up study
// research.mjs states for positive replies (`herald-followups-roi` / `herald-followups-rate`):
// every email of a sequence that asks for a reply, filed under its place in the sequence (first
// email, follow-up 1, 2, 3), with the positive replies attributed to the last email sent before
// the reply. So the article and the Research page state the same figures for one extract.
// Aggregates only: no text, no client, no lead, no campaign.
import { readFileSync } from "node:fs";

const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: derive-followups.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
const R = facts.research;
const M = facts.researchMaturity;
if (!R?.reply?.byStep) throw new Error("facts.json carries no step cut: re-run derive.mjs");
if (!M?.legs?.reply) throw new Error("facts.json carries no researchMaturity: re-run derive.mjs");

const m = M.legs.reply;
const snapshot = {
  windowFrom: facts.window.from,
  readOn: facts.generatedAt.slice(0, 10),
  windowEnd: M.windowEnd,
  legKey: m.legKey,
  durationDays: m.durationDays,
  outcomesRequired: m.outcomesRequired,
  cutoff: m.cutoff,
  steps: R.reply.byStep.map((r) => ({ bucket: r.bucket, emails: r.emails, replies: r.replies, spend: r.spend })),
  crmRepliesAdded: R.crmReplies?.added ?? 0,
};
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
