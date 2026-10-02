// Every Research study states what its data can carry, in one of three words (owner, 2026-10-02):
//   conclusion: the leader beats the runner-up on the crude counts AND on the same clients in the
//               same months (like-for-like.mjs), both after a Bonferroni correction for every
//               comparison the study makes;
//   signal:     the crude gap is under 5% chance alone, but it fails the correction or the
//               like-for-like check (or that check cannot run): a lead to confirm;
//   noise:      anything else, a leader resting on fewer than MIN_OUTCOMES outcomes included.
// The leader stays the first bar whatever the word. research.mjs calls this; nothing here prints.
import { likeForLike, sharedPairs } from "./like-for-like.mjs";

export const MIN_OUTCOMES = 5;
const ALPHA = 0.05;

const lgamma = (z) => {
  // Lanczos, good to ~1e-13 for z > 0
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

// Two arms, outcomes over an exposure (emails, people or dollars): given the total, the arm an
// outcome lands on is binomial with that arm's share of the exposure if both share one rate.
// Exact two-sided p-value.
export function exactP(xa, ea, xb, eb) {
  const n = xa + xb;
  if (n === 0 || ea <= 0 || eb <= 0) return 1;
  const q = ea / (ea + eb);
  const logP = (k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(q) + (n - k) * Math.log(1 - q);
  const obs = logP(xa);
  let p = 0;
  for (let k = 0; k <= n; k++) {
    const lk = logP(k);
    if (lk <= obs + 1e-9) p += Math.exp(lk);
  }
  return Math.min(1, p);
}

// The like-for-like ratio's p-value, read off its 95% interval (log scale, normal).
function pOfInterval(ci) {
  if (!ci) return 1;
  const se = (Math.log(ci.hi) - Math.log(ci.lo)) / (2 * 1.96);
  if (!(se > 0)) return 1;
  const z = Math.abs(Math.log(ci.ratio)) / se;
  const t = 1 / (1 + 0.2316419 * z);
  const tail = (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return Math.min(1, 2 * tail);
}

const pText = (p) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/**
 * Leader against runner-up on a categorical cut.
 * a, b: { label, outcomes, emails, spend }; goal "rate" (per email) or "roi" (per dollar);
 * comparisons: how many other buckets the leader was ranked against (Bonferroni);
 * strata: optional derive.mjs per-bucket strata map ({ [label]: { [stratum]: counts } }) and the
 * outcome key in it ("clicks" | "replies").
 */
export function compareVerdict({ a, b, goal, comparisons, strata, count, noun, nouns, splitTest = false }) {
  if (!a) return { kind: "noise", reason: `No ${nouns} yet.` };
  if (!b) return { kind: "noise", reason: `Only one side has sent anything: nothing to compare.` };
  if (a.outcomes < MIN_OUTCOMES) {
    return { kind: "noise", reason: `${a.label} rests on ${plural(a.outcomes, noun, nouns)}; a lead needs at least ${MIN_OUTCOMES} before chance stops dominating.` };
  }
  const exp = goal === "roi" ? "spend" : "emails";
  const p = exactP(a.outcomes, a[exp], b.outcomes, b[exp]);
  const m = Math.max(1, comparisons);
  const alpha = ALPHA / m;
  const per = goal === "roi" ? "per dollar" : "per email";
  const vs = `${a.label} against ${b.label}, ${nouns} ${per}`;
  const corr = m > 1 ? ` (${m} comparisons, so the bar is p < ${pText(alpha)})` : "";
  if (p >= ALPHA) return { kind: "noise", reason: `${vs}: p ${pText(p)}, a gap chance alone produces often.`, p };
  if (splitTest) {
    return p < alpha
      ? { kind: "conclusion", reason: `${vs}: p ${pText(p)}${corr}, on the same people.`, p }
      : { kind: "signal", reason: `${vs}: p ${pText(p)}, but not under the corrected bar${corr}.`, p };
  }
  if (p >= alpha) return { kind: "signal", reason: `${vs}: p ${pText(p)}, but not under the corrected bar${corr}.`, p };
  const pairs = strata?.[a.label] && strata?.[b.label] ? sharedPairs(strata[a.label], strata[b.label], count) : [];
  if (!pairs.length) return { kind: "signal", reason: `${vs}: p ${pText(p)}${corr}, but the two never ran for the same client in the same month, so the gap may be the clients'.`, p };
  const lfl = likeForLike(pairs);
  const ci = goal === "roi" ? (lfl.cost ? { ratio: 1 / lfl.cost.ratio, lo: 1 / lfl.cost.hi, hi: 1 / lfl.cost.lo } : null) : lfl.rate;
  const pl = pOfInterval(ci);
  const same = ci && ci.ratio > 1;
  if (same && pl < alpha) return { kind: "conclusion", reason: `${vs}: p ${pText(p)}${corr}, and it holds on the same clients in the same months (${ci.ratio.toFixed(2)}x, p ${pText(pl)}).`, p };
  return { kind: "signal", reason: `${vs}: p ${pText(p)}${corr}, but on the same clients in the same months it reads ${ci ? `${ci.ratio.toFixed(2)}x (p ${pText(pl)})` : "too few to compare"}: the gap may be the clients'.`, p };
}

// The headline's verb follows the word: a conclusion "wins", anything else only "leads".
export function headlineFor(headline, kind) {
  if (kind === "conclusion") return headline;
  const led = headline.replace(/ wins( at| with|:)/, " leads$1");
  return `${led} ${kind === "signal" ? "A signal to confirm, not yet a conclusion." : "Noise so far."}`;
}
