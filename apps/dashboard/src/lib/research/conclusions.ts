/**
 * The Research CONCLUSIONS as a backend service reads them (social-service quotes them in the
 * takes it posts as Kevin / distribute.you). Served by `GET /api/internal/research/conclusions`,
 * service key only.
 *
 * Only a study whose verdict is `conclusion` (and whose status is `measured`) leaves this module:
 * a `signal` or `noise` study must never be quoted publicly, so it is not served at all. The
 * figures are the BILLED basis (`research.json`, what clients paid), never the `actual` one
 * (vendor cost, reveals our margin).
 *
 * Nothing here computes a figure: every `statement` and `sample` is a string research.mjs wrote,
 * copied as the Research page renders it. A chart point marked Learning (`thin`) or without a
 * value yet is left out, since the page itself does not stand behind it.
 *
 * Alias-free so it carries real unit tests.
 */
import type { ResearchFile, ResearchStudy } from "./research";

/** One quotable fact: the claim, and the counts it rests on (null when the claim states its own). */
export interface ResearchFact {
  statement: string;
  sample: string | null;
}

export interface ResearchConclusion {
  id: string;
  /** Which outcome it measures, in plain words (crew names are internal, never served). */
  outcome: string;
  question: string;
  headline: string;
  verdict: { kind: "conclusion"; reason: string };
  result: { display: string; unit: string; sample: string } | null;
  facts: ResearchFact[];
}

export interface ResearchConclusionsBody {
  generatedAt: string;
  readOn: string;
  window: { from: string; to: string };
  costBasis: "user";
  conclusions: ResearchConclusion[];
}

/** Displays that state no value (a bucket with nothing measured yet). */
const NO_VALUE = /^none yet$/i;

function factsOf(study: ResearchStudy): ResearchFact[] {
  const sample = study.result?.sample ?? null;
  const facts: ResearchFact[] = [];
  if (study.result) facts.push({ statement: `${study.headline} (${study.result.display} ${study.result.unit})`, sample });
  else facts.push({ statement: study.headline, sample: null });
  if (study.verdict) facts.push({ statement: study.verdict.reason, sample });
  for (const line of study.conclusion) facts.push({ statement: line, sample });
  for (const chart of study.charts) {
    const series = [{ title: chart.title, points: chart.points }];
    if (chart.cumulative) series.push({ title: chart.cumulative.title, points: chart.cumulative.points });
    for (const s of series) {
      for (const p of s.points) {
        if (p.thin || NO_VALUE.test(p.display.trim())) continue;
        facts.push({ statement: `${s.title}: ${p.label}, ${p.display}`, sample: p.note });
      }
    }
  }
  return facts;
}

export function researchConclusions(file: ResearchFile): ResearchConclusionsBody {
  if (file.costBasis !== undefined && file.costBasis !== "user") {
    throw new Error(`[dashboard] research conclusions must come from the billed basis, got ${file.costBasis}`);
  }
  const outcomeOf = new Map(file.crews.map((c) => [c.id, c.outcome]));
  const conclusions: ResearchConclusion[] = [];
  for (const study of file.studies) {
    if (study.status !== "measured" || study.verdict?.kind !== "conclusion") continue;
    const outcome = outcomeOf.get(study.crew);
    if (!outcome) throw new Error(`[dashboard] research study ${study.id} names crew ${study.crew}, absent from the file's crews`);
    conclusions.push({
      id: study.id,
      outcome,
      question: study.question,
      headline: study.headline,
      verdict: { kind: "conclusion", reason: study.verdict.reason },
      result: study.result,
      facts: factsOf(study),
    });
  }
  return { generatedAt: file.generatedAt, readOn: file.readOn, window: file.window, costBasis: "user", conclusions };
}
