// What a Research refresh changed, in words: the verdict counts before and after, then every
// study whose verdict or winner moved. The nightly refresh (refresh.sh) puts it in the PR body,
// since a moved CONCLUSION changes what social-service posts the next day.
//
//   node research-diff.mjs <old research.json> <new research.json>
//
// Pure read of two snapshots; prints markdown.
import { readFileSync } from "node:fs";

const STUDY_URL =
  "https://dashboard.distribute.you/v2/orgs/org_3JurY09CbH3pzopU7YtanCR7UlL/brands/01800fc5-3934-4901-858a-60c8e59e2e9c/research/";

const [oldPath, newPath] = process.argv.slice(2);
if (!oldPath || !newPath) throw new Error("usage: research-diff.mjs <old research.json> <new research.json>");
const before = JSON.parse(readFileSync(oldPath, "utf8"));
const after = JSON.parse(readFileSync(newPath, "utf8"));

function diffStudies(oldStudies, newStudies) {
  const kind = (s) => s?.verdict?.kind ?? "none";
  const counts = (studies) => {
    const c = { conclusion: 0, signal: 0, noise: 0 };
    for (const s of studies) if (s.verdict) c[s.verdict.kind] = (c[s.verdict.kind] ?? 0) + 1;
    return c;
  };
  const oldById = new Map(oldStudies.map((s) => [s.id, s]));
  const newIds = new Set(newStudies.map((s) => s.id));
  const changed = [];
  for (const s of newStudies) {
    const o = oldById.get(s.id);
    if (!o) changed.push({ id: s.id, question: s.question, change: `new study: ${kind(s)}, ${s.headline}` });
    else if (kind(o) !== kind(s) || o.winner !== s.winner)
      changed.push({
        id: s.id,
        question: s.question,
        change: `${kind(o)} (${o.winner ?? "no winner"}) → ${kind(s)} (${s.winner ?? "no winner"}): ${s.headline}`,
      });
  }
  for (const o of oldStudies) if (!newIds.has(o.id)) changed.push({ id: o.id, question: o.question, change: "study removed" });
  return { before: counts(oldStudies), after: counts(newStudies), changed };
}

const d = diffStudies(before.studies, after.studies);
const c = (x) => `${x.conclusion} conclusions, ${x.signal} signals, ${x.noise} noise`;
const lines = [
  `Window ${after.window.from} to ${after.readOn} (was read on ${before.readOn}).`,
  "",
  `Verdicts: ${c(d.before)} → ${c(d.after)}.`,
  "",
];
if (!d.changed.length) lines.push("No verdict and no winner changed.");
else {
  lines.push(`${d.changed.length} studies changed:`, "");
  for (const x of d.changed) lines.push(`- [${x.question}](${STUDY_URL}${x.id}): ${x.change}`);
}
console.log(lines.join("\n"));
