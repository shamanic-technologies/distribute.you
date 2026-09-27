#!/usr/bin/env node
// Derives every figure the open-tracking article states from the committed snapshot.
//
//   node derive-pixel.mjs pixel.snapshot.json > /tmp/pixel-facts.json
//
// A rate is a count of LEADS over the leads of that arm (one sequence = one lead, counted
// once however many steps it received). "Delivered" drops the leads whose email bounced,
// so a list-quality difference between the two periods does not sit inside the reply rate.
// Each comparison carries a two-proportion z-test: the article states its p-value in the
// limits section, it does not dress a small sample up as a proof.
import { readFileSync } from "node:fs";

const snap = JSON.parse(readFileSync(process.argv[2] ?? new URL("./pixel.snapshot.json", import.meta.url), "utf8"));
const arm = (name) => {
  const a = snap.arms.find((r) => r.arm === name);
  if (!a) throw new Error(`no arm ${name}`);
  return a;
};
const on = arm("on");
const off = arm("off");
const unplaced = snap.arms.find((r) => r.arm === "unplaced") ?? { leads: 0 };

// Abramowitz and Stegun 7.1.26, good to 1.5e-7: enough for a p-value printed to 2 digits.
const erf = (x) => {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const twoSidedP = (z) => 1 - erf(Math.abs(z) / Math.SQRT2);

const pct = (n, d, digits = 2) => Number(((n / d) * 100).toFixed(digits));
function compare(metric, denom = "leads") {
  const x1 = on[metric], n1 = on[denom], x2 = off[metric], n2 = off[denom];
  const p1 = x1 / n1, p2 = x2 / n2, p = (x1 + x2) / (n1 + n2);
  const z = (p2 - p1) / Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  const pv = twoSidedP(z);
  return {
    on: { count: x1, of: n1, pct: pct(x1, n1) },
    off: { count: x2, of: n2, pct: pct(x2, n2) },
    liftPct: Math.round((p2 / p1 - 1) * 100),
    z: Number(z.toFixed(2)),
    p: pv < 0.001 ? "< 0.001" : pv.toFixed(pv < 0.01 ? 3 : 2),
    significant: pv < 0.05,
  };
}

const facts = {
  readAt: snap.readAt.slice(0, 10),
  cutoff: snap.cutoff,
  on: { leads: on.leads, emails: on.emails, firstDay: on.first_day, lastDay: on.last_day, openPct: pct(on.opened, on.leads, 1) },
  off: { leads: off.leads, emails: off.emails, firstDay: off.first_day, lastDay: off.last_day, openPct: pct(off.opened, off.leads, 1) },
  total: { leads: on.leads + off.leads, emails: on.emails + off.emails, unplaced: unplaced.leads },
  // the headline: a person wrote back (auto-replies and out-of-office excluded)
  replied: compare("replied"),
  // the same, among leads whose email did not bounce
  repliedDelivered: compare("replied_delivered", "delivered"),
  positive: compare("positive"),
  clicked: compare("clicked"),
  bounced: compare("bounced"),
  unsubscribed: compare("unsubscribed"),
  autoReplied: compare("auto_replied"),
};
const rounded = Math.floor(facts.total.emails / 10000) * 10000;
facts.total.emailsRounded = rounded;
console.log(JSON.stringify(facts, null, 1));
