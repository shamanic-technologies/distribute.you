// Compares two arms (two LLMs, two model tiers) on the SAME client in the SAME month only, so a
// client mix cannot pass for an arm effect: a model that happened to write for the clients whose
// prospects click most would otherwise "win" without writing better emails.
//
// `pairs` is one entry per stratum both arms ran in: [a, b], each { emails, outcomes, spend }.
// The rate ratio is Mantel-Haenszel pooled over the strata, with a 95% interval from the
// Greenland-Robins variance. The price ratio (spend per email) is read on the same strata, and the
// cost per outcome ratio is the price ratio over the rate ratio, its interval from the rate's.
// Shared by research.mjs (the Research page) and llm/render-llm-article.mjs (the blog article),
// so the two can never state different figures for one extract.
export function likeForLike(pairs) {
  let num = 0, den = 0, v = 0;
  const a = { emails: 0, outcomes: 0, spend: 0, strata: pairs.length };
  const b = { emails: 0, outcomes: 0, spend: 0, strata: pairs.length };
  for (const [x, y] of pairs) {
    const T = x.emails + y.emails;
    num += (x.outcomes * y.emails) / T;
    den += (y.outcomes * x.emails) / T;
    v += (x.emails * y.emails * (x.outcomes + y.outcomes)) / (T * T);
    for (const [acc, s] of [[a, x], [b, y]]) {
      acc.emails += s.emails;
      acc.outcomes += s.outcomes;
      acc.spend += s.spend;
    }
  }
  const price = a.emails && b.emails && b.spend ? a.spend / a.emails / (b.spend / b.emails) : null;
  if (!num || !den) return { a, b, price, rate: null, cost: null };
  const rr = num / den;
  const se = Math.sqrt(v / (num * den));
  const lo = rr * Math.exp(-1.96 * se), hi = rr * Math.exp(1.96 * se);
  return {
    a,
    b,
    price,
    rate: { ratio: rr, lo, hi },
    cost: price === null ? null : { ratio: price / rr, lo: price / hi, hi: price / lo },
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
