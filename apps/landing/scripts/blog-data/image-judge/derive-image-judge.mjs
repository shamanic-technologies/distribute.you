#!/usr/bin/env node
// Writes the snapshot the article `ai-lead-qualification` is rendered from.
//
//   node derive-image-judge.mjs benchmark.json > image-judge.snapshot.json
//
// benchmark.json is the hand-checked benchmark of 2026-10-21: every stored homepage screenshot of
// lead-service with its old written description, each asked four "detail" questions two ways with
// Jev 1.13 (on the description, as before 2026-10-21; on the image itself, as since), every
// disagreement checked by eye. Sites are anonymised (no client, no prospect domain).
//
// The test is paired (same screenshot, same question, same judge): only the disagreements carry
// information, and under "both ways are equally good" each one is a coin flip (exact sign test,
// verdict.mjs's exactP with equal exposures). Bonferroni over the four questions. A question that
// is not a conclusion is never stated as one; noise is not stated at all.
import { readFileSync } from "node:fs";
import { exactP } from "../verdict.mjs";

const path = process.argv[2];
if (!path) throw new Error("usage: derive-image-judge.mjs <benchmark.json>");
const B = JSON.parse(readFileSync(path, "utf8"));
const QUESTIONS = Object.keys(B.questions);
const ALPHA = 0.05;

const decided = (v) => v === "yes" || v === "no";
const pText = (p) => (p < 0.001 ? "< 0.001" : p.toFixed(3));

// One question: every scored disagreement (both ways decided, the truth checked by eye, not ambiguous).
function sign(rows) {
  const dis = rows.filter((r) => decided(r.description) && decided(r.image) && r.description !== r.image);
  const unchecked = dis.filter((r) => r.truth === null);
  if (unchecked.length) throw new Error(`${unchecked.length} disagreements were never checked by eye`);
  const scored = dis.filter((r) => r.truth !== "ambiguous");
  const image = scored.filter((r) => r.image === r.truth).length;
  const description = scored.filter((r) => r.description === r.truth).length;
  if (image + description !== scored.length) throw new Error("a scored disagreement matches neither answer");
  return { disagreements: dis.length, ambiguous: dis.length - scored.length, scored: scored.length, image, description, p: exactP(image, 1, description, 1) };
}

const perQuestion = QUESTIONS.map((q) => {
  const rows = B.rows.filter((r) => r.question === q);
  const s = sign(rows);
  const bonferroni = Math.min(1, s.p * QUESTIONS.length);
  const kind = s.image <= s.description ? "noise" : bonferroni < ALPHA ? "conclusion" : s.p < ALPHA ? "signal" : "noise";
  // Which way the description erred: a silent description reads as "not on the page".
  const missed = rows.filter((r) => decided(r.description) && decided(r.image) && r.description !== r.image && r.truth === r.image).length;
  return { question: q, text: B.questions[q], screenshots: rows.length, ...s, pText: pText(s.p), bonferroniText: pText(bonferroni), kind, missed };
});

const pooled = perQuestion.reduce((a, q) => ({ scored: a.scored + q.scored, image: a.image + q.image, description: a.description + q.description, ambiguous: a.ambiguous + q.ambiguous, disagreements: a.disagreements + q.disagreements }), { scored: 0, image: 0, description: 0, ambiguous: 0, disagreements: 0 });
pooled.p = exactP(pooled.image, 1, pooled.description, 1);
pooled.pText = pText(pooled.p);
if (!(pooled.p < ALPHA / QUESTIONS.length)) throw new Error("the pooled difference is not a conclusion: nothing to publish");

// The case: 33 roofing homepages, every header checked by eye, the phone question.
const caseRows = B.rows.filter((r) => r.question === "phone" && /every header/.test(r.checked ?? ""));
if (caseRows.length !== 33) throw new Error(`the roofing case holds ${caseRows.length} homepages, expected 33`);
const judged = caseRows.filter((r) => decided(r.description) && decided(r.image));
const right = (k) => judged.filter((r) => r[k] === r.truth).length;
const roof = {
  homepages: caseRows.length,
  noPhone: caseRows.filter((r) => r.truth === "yes").length,
  withPhone: caseRows.filter((r) => r.truth === "no").length,
  judged: judged.length,
  descriptionRight: right("description"),
  imageRight: right("image"),
  phoneMissed: judged.filter((r) => r.truth === "no" && r.description === "yes").length,
  descriptionLeads: judged.filter((r) => r.description === "yes").length,
  imageLeads: judged.filter((r) => r.image === "yes").length,
  realLeads: judged.filter((r) => r.truth === "yes").length,
};
const flips = judged.filter((r) => r.description !== r.image);
roof.pText = pText(exactP(flips.filter((r) => r.image === r.truth).length, 1, flips.filter((r) => r.description === r.truth).length, 1));
roof.multiple = (roof.imageRight / roof.descriptionRight).toFixed(1);
if (roof.imageRight <= roof.descriptionRight) throw new Error("the image no longer beats the description on the case");

// Questions a description covers: the two ways agree on every decided pair but how many?
const covered = Object.keys(B.covered.questions).map((q) => {
  const rows = B.covered.rows.filter((r) => r.question === q);
  const both = rows.filter((r) => decided(r.description) && decided(r.image));
  return { question: q, checks: rows.length, decided: both.length, agree: both.filter((r) => r.description === r.image).length };
});
const coveredTotals = covered.reduce((a, c) => ({ checks: a.checks + c.checks, decided: a.decided + c.decided, agree: a.agree + c.agree }), { checks: 0, decided: 0, agree: 0 });

// Four judges on the phone question, read on the image (no winner is named: the gap is within noise).
const judgeRight = Object.values(B.judgesOnPhone.right);
const judges = { count: judgeRight.length, homepages: B.judgesOnPhone.homepages, min: Math.min(...judgeRight), max: Math.max(...judgeRight) };
if (judges.max - judges.min > 2) throw new Error("the judges now differ by more than noise on the phone question: rewrite the objection");

process.stdout.write(
  JSON.stringify(
    {
      readOn: B.readOn,
      judge: B.judge,
      screenshots: new Set(B.rows.map((r) => r.site)).size,
      questions: QUESTIONS.length,
      checks: B.rows.length,
      roof,
      perQuestion,
      byQuestion: Object.fromEntries(perQuestion.map((q) => [q.question, q])),
      pooled,
      covered,
      judges,
      coveredTotals,
    },
    null,
    1,
  ) + "\n",
);
