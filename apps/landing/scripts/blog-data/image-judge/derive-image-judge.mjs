#!/usr/bin/env node
// Writes the snapshot the article `ai-lead-qualification` is rendered from.
//
//   node derive-image-judge.mjs judges.json > image-judge.snapshot.json
//
// judges.json is the benchmark of 2026-10-21: every homepage screenshot our lead qualification checks
// had stored (sites anonymised), five yes/no qualification questions, asked of each screenshot by six
// models through our model router (Jev 1.13, GPT-6 Luna, Gemini 3.1 and 3.5 Flash-Lite, Claude Haiku
// and Sonnet 5.5). An answer is right when it is in `accepted`: the answer all six gave, or what we
// saw by eye wherever they split; a cookie wall makes "unreadable" acceptable beside the visible
// answer; an item we could not settle by eye is `ambiguous` and not scored. Price = what the run
// billed (our list price), divided by the checks asked.
//
// Paired comparison against Jev (same item, same screenshot): exact sign test on the items where one
// is right and the other wrong, Bonferroni over the five rivals. No rival is named better or worse
// unless that test says so.
import { readFileSync } from "node:fs";
import { exactP } from "../verdict.mjs";

const path = process.argv[2];
if (!path) throw new Error("usage: derive-image-judge.mjs <judges.json>");
const B = JSON.parse(readFileSync(path, "utf8"));
const ALPHA = 0.05;
const QUESTIONS = Object.keys(B.questions);
const scored = B.rows.filter((r) => r.accepted !== "ambiguous");
const right = (r, m) => r.accepted.includes(r.answers[m]);
const pText = (p) => (p < 0.001 ? "< 0.001" : p.toFixed(2));

// Wilson 95% interval on a share.
function wilson(k, n) {
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: (c - h) / d, hi: (c + h) / d };
}
const pct = (x) => `${(100 * x).toFixed(1)}%`;

const models = B.models.map((m) => {
  const k = scored.filter((r) => right(r, m.key)).length;
  const ci = wilson(k, scored.length);
  const noAnswer = B.rows.filter((r) => r.answers[m.key] === "error").length;
  const perThousand = (m.billedCents / 100 / m.calls) * 1000;
  const perQuestion = Object.fromEntries(QUESTIONS.map((q) => {
    const rs = scored.filter((r) => r.question === q);
    return [q, { right: rs.filter((r) => right(r, m.key)).length, scored: rs.length }];
  }));
  return { key: m.key, label: m.label, right: k, scored: scored.length, share: k / scored.length, display: pct(k / scored.length), per100: Math.floor((100 * k) / scored.length), per100Display: ((100 * k) / scored.length).toFixed(1), ciLo: pct(ci.lo), ciHi: pct(ci.hi), noAnswer, perThousand, perThousandDisplay: `$${perThousand.toFixed(2)}`, perQuestion };
});
const jev = models.find((m) => m.key === "jev");
if (!jev) throw new Error("no Jev in the benchmark");
const rivals = models.filter((m) => m.key !== "jev");
for (const m of rivals) {
  const r = B.models.length - 1;
  const jevOnly = scored.filter((x) => right(x, "jev") && !right(x, m.key)).length;
  const otherOnly = scored.filter((x) => right(x, m.key) && !right(x, "jev")).length;
  const p = exactP(jevOnly, 1, otherOnly, 1);
  m.vsJev = { jevOnly, otherOnly, p, pText: pText(p), bonferroni: pText(Math.min(1, p * r)), kind: Math.min(1, p * r) < ALPHA ? "conclusion" : p < ALPHA ? "signal" : "noise" };
}
const anyDifference = rivals.some((m) => m.vsJev.kind !== "noise");

const byPrice = [...models].sort((a, b) => a.perThousand - b.perThousand);
const dearest = byPrice[byPrice.length - 1];
const cheapest = byPrice[0];
const accuracy = { min: Math.min(...models.map((m) => m.per100)), max: Math.max(...models.map((m) => m.per100)) };

process.stdout.write(
  JSON.stringify(
    {
      readOn: B.readOn,
      screenshots: B.screenshots,
      questions: QUESTIONS.length,
      checksPerModel: B.rows.length,
      scored: scored.length,
      ambiguous: B.rows.length - scored.length,
      truth: {
        unanimous: scored.filter((r) => r.truthFrom === "unanimous").length,
        eye: scored.filter((r) => r.truthFrom !== "unanimous").length,
      },
      models,
      byKey: Object.fromEntries(models.map((m) => [m.key, m])),
      anyDifference,
      accuracy,
      cheapest: { label: cheapest.label, display: cheapest.perThousandDisplay },
      dearest: { label: dearest.label, display: dearest.perThousandDisplay, timesJev: Math.round(dearest.perThousand / jev.perThousand) },
      notScored: B.notScored,
    },
    null,
    1,
  ) + "\n",
);
