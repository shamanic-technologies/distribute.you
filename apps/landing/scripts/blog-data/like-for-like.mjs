// Compares two arms (two LLMs, two model tiers) on the SAME client in the SAME month only, so a
// client mix cannot pass for an arm effect: a model that happened to write for the clients whose
// prospects click most would otherwise "win" without writing better emails.
//
// `pairs` is one entry per stratum both arms ran in: [a, b], each { emails, outcomes, spend }.
// Two Mantel-Haenszel rate ratios, each with a 95% Greenland-Robins interval: outcomes per EMAIL
// (the rate) and outcomes per DOLLAR (spend as the exposure); the cost per outcome ratio is the
// inverse of the second. Never the crude price ratio divided by the pooled rate ratio: the two carry
// different weights, and that shortcut read 0.46x where the per-dollar pooling reads 0.57x
// (2026-10-02, Flash against Pro on website visits). Used by research.mjs (the LLM studies).
export function likeForLike(pairs) {
  let num = 0, den = 0, v = 0, numS = 0, denS = 0, vS = 0;
  const a = { emails: 0, outcomes: 0, spend: 0, strata: pairs.length };
  const b = { emails: 0, outcomes: 0, spend: 0, strata: pairs.length };
  for (const [x, y] of pairs) {
    const T = x.emails + y.emails;
    num += (x.outcomes * y.emails) / T;
    den += (y.outcomes * x.emails) / T;
    v += (x.emails * y.emails * (x.outcomes + y.outcomes)) / (T * T);
    const S = x.spend + y.spend;
    if (S > 0) {
      numS += (x.outcomes * y.spend) / S;
      denS += (y.outcomes * x.spend) / S;
      vS += (x.spend * y.spend * (x.outcomes + y.outcomes)) / (S * S);
    }
    for (const [acc, s] of [[a, x], [b, y]]) {
      acc.emails += s.emails;
      acc.outcomes += s.outcomes;
      acc.spend += s.spend;
    }
  }
  const price = a.emails && b.emails && b.spend ? a.spend / a.emails / (b.spend / b.emails) : null;
  if (!num || !den) return { a, b, price, rate: null, cost: null };
  const ci = (n, d, va) => {
    const r = n / d;
    const se = Math.sqrt(va / (n * d));
    return { ratio: r, lo: r * Math.exp(-1.96 * se), hi: r * Math.exp(1.96 * se) };
  };
  const rate = ci(num, den, v);
  // outcomes per dollar, inverted: a cost per outcome ratio and its interval
  const perDollar = numS && denS ? ci(numS, denS, vS) : null;
  return {
    a,
    b,
    price,
    rate,
    cost: perDollar ? { ratio: 1 / perDollar.ratio, lo: 1 / perDollar.hi, hi: 1 / perDollar.lo } : null,
  };
}

// The strata two arms share, out of derive.mjs's per-arm maps ({ [stratum]: { emails, clicks,
// replies, spend } }), read on one outcome count ("clicks" or "replies").
export function sharedPairs(armA, armB, count) {
  const out = [];
  for (const [k, x] of Object.entries(armA || {})) {
    const y = armB?.[k];
    if (!y) continue;
    out.push([
      { emails: x.emails, outcomes: x[count], spend: x.spend },
      { emails: y.emails, outcomes: y[count], spend: y.spend },
    ]);
  }
  return out;
}
