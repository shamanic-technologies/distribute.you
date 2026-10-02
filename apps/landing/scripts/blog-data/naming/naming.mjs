// Naming the client: the derivation behind the Research page's naming studies (research.mjs,
// `herald-naming-rate` / `herald-naming-roi`). Its blog article was taken down on 2026-10-02.
//
// Does an email that keeps the client's name back get more positive replies, and cheaper ones,
// than one that names it? Each template VERSION is put on a side by what its prompt tells the
// model, read here from the prompt text itself, never from the template's family name: some
// "blind" versions tell the model to name the client and some "cold" ones to keep it back. A
// prompt that says both stops the run (a person must read it); one that says neither is left out
// and counted. Only asked of the reply outcome: a website visit needs the name and the link.
export const NAMES_CLIENT = /(?<!never )(?<!not )\bname the client\b|\bDO name the brand\b|\bname the (?:client )?brand\b|reveal the brand name and website|naming them, recommending them|you can name the agency/i;
export const KEEPS_CLIENT_BACK = /never (?:name|reveal|mention) the (?:client|agency)|not (?:reveal|mention) the client|client's name[^.\n]*(?:hidden|replaced)|name and URL stay hidden|do not mention the client|keeping the client anonymous|never mention the client's brand name|without naming the agency/i;

export function namingOf(templateTexts, template) {
  const text = templateTexts.get(template);
  if (!text) return null;
  const named = NAMES_CLIENT.test(text), held = KEEPS_CLIENT_BACK.test(text);
  if (named && held) throw new Error(`template ${template} both names the client and keeps it back: read its prompt and sharpen the naming rule`);
  return named ? "named" : held ? "held" : null;
}

// Two-sided p-values, printed like the open-tracking study's. erf: Abramowitz and Stegun 7.1.26.
const erf = (x) => {
  const sg = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return sg * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
};
export const pText = (pv) => (pv < 0.001 ? "< 0.001" : pv.toFixed(pv < 0.01 ? 3 : 2));
// Rate: a two-proportion z-test on outcomes over emails.
export function rateP(a, b, o) {
  const x1 = a[o.count], n1 = a.emails, x2 = b[o.count], n2 = b.emails, pool = (x1 + x2) / (n1 + n2);
  const z = (x1 / n1 - x2 / n2) / Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2));
  return 1 - erf(Math.abs(z) / Math.SQRT2);
}
// Cost: outcomes per dollar. Given the total, the side an outcome lands on is binomial with
// that side's share of the spend if both buy outcomes at the same price; exact two-sided test.
export function costP(a, b, o) {
  const k = a[o.count] + b[o.count], q = a.spend / (a.spend + b.spend);
  if (!k) return 1;
  const lg = (m) => { let v = 0; for (let i = 2; i <= m; i++) v += Math.log(i); return v; };
  const pmf = (i) => Math.exp(lg(k) - lg(i) - lg(k - i) + i * Math.log(q) + (k - i) * Math.log(1 - q));
  const seen = pmf(a[o.count]);
  let pv = 0;
  for (let i = 0; i <= k; i++) { const v = pmf(i); if (v <= seen * (1 + 1e-7)) pv += v; }
  return Math.min(1, pv);
}

export const NAMING_LABEL = { held: "Client not named", named: "Client named" };

// The two sides, from the research block of ONE outcome (`facts.research.reply`, already scoped
// to its leg and cut at the maturation window). `rows` is [held, named].
export function namingSides(o, R, templateTexts) {
  const side = { held: { emails: 0, spend: 0, versions: 0 }, named: { emails: 0, spend: 0, versions: 0 } };
  side.held[o.count] = 0; side.named[o.count] = 0;
  let silent = 0;
  for (const r of R.byTemplate) {
    const k = namingOf(templateTexts, r.bucket);
    if (!k) { silent += r.emails; continue; }
    side[k].emails += r.emails; side[k].spend += r.spend; side[k][o.count] += r[o.count]; side[k].versions += 1;
  }
  const total = R.byMonth.reduce((t, r) => t + r.emails, 0);
  // emails whose template was never recorded carry no prompt to read
  const unrecorded = total - side.held.emails - side.named.emails - silent;
  const rows = ["held", "named"].map((k) => {
    const x = side[k];
    return {
      bucket: NAMING_LABEL[k],
      side: k,
      emails: x.emails,
      spend: Number(x.spend.toFixed(2)),
      [o.count]: x[o.count],
      [o.rate]: x.emails ? Number(((x[o.count] / x.emails) * o.per).toFixed(2)) : 0,
      [o.cost]: x[o.count] ? Number((x.spend / x[o.count]).toFixed(2)) : null,
      versions: x.versions,
    };
  });
  const [held, named] = rows;
  if (!held.emails || !named.emails) throw new Error("naming the client: one side sent nothing, the study cannot compare");
  return { rows, held, named, silent, unrecorded, total };
}
