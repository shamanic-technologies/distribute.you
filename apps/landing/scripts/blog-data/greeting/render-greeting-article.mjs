#!/usr/bin/env node
// Renders the article `cold-email-greeting` from its prose template and the committed snapshot
// derive-greeting.mjs writes.
//
//   node render-greeting-article.mjs <greeting.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here. The arms ran on different clients and
// models, so they are compared by RATE (outcomes per email): a cost per outcome would also carry
// each arm's model price. The headline is marketing, the small print sits at the bottom, and
// neither may say something the data does not hold: the renderer refuses a snapshot where the
// visit winner stops beating the runner-up, or where the replies start to differ.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "cold-email-greeting";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-greeting-article.mjs <greeting.snapshot.json> <content-dir>");
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));

// The three openings, named by first-email-shape.mjs. A bucket is named, never indexed.
const KEY = { "No greeting": "none", "First name alone": "name", "Greeting + first name": "greet" };
const LEG = {
  visit: { count: "clicks", noun: "website visit", nouns: "website visits", emails: "emails with a link" },
  reply: { count: "replies", noun: "positive reply", nouns: "positive replies", emails: "emails" },
};

// Exact 95% Poisson interval on a count, by bisection on the cumulative distribution.
function poissonCdf(k, lambda) {
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum += term;
  }
  return sum;
}
function solve(f, target) {
  let lo = 0;
  let hi = 1e6;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
function interval(k) {
  const lower = k === 0 ? 0 : solve((l) => poissonCdf(k - 1, l), 0.975);
  const upper = solve((l) => poissonCdf(k, l), 0.025);
  return [lower, upper];
}
// Two-sided p-value that two arms share one rate: conditional binomial, normal approximation.
function pSame(a, b) {
  const n = a.outcomes + b.outcomes;
  const p = a.emails / (a.emails + b.emails);
  const z = Math.abs(a.outcomes - n * p) / Math.sqrt(n * p * (1 - p));
  const t = 1 / (1 + 0.2316419 * z);
  const tail = (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 2 * tail;
}

function sideOf(legKey, row) {
  const outcomes = row[LEG[legKey].count];
  const [lo, hi] = interval(outcomes);
  return { label: row.bucket, emails: row.emails, outcomes, rate: outcomes / row.emails, lo: lo / row.emails, hi: hi / row.emails };
}
function legOf(legKey) {
  const l = snap[legKey];
  const named = (rows) => {
    const out = {};
    for (const r of rows) {
      const k = KEY[r.bucket];
      if (!k) throw new Error(`unknown opening bucket: ${r.bucket}`);
      out[k] = sideOf(legKey, r);
    }
    return out;
  };
  const all = named(l.all);
  for (const k of Object.values(KEY)) if (!all[k]) throw new Error(`${legKey}: no ${k} bucket`);
  const tiers = Object.fromEntries(Object.entries(l.tiers).map(([t, rows]) => [t, named(rows)]));
  const totals = Object.values(all).reduce((t, s) => ({ emails: t.emails + s.emails, outcomes: t.outcomes + s.outcomes }), { emails: 0, outcomes: 0 });
  return { ...l, ...all, tiers, totals };
}
const v = legOf("visit");
const r = legOf("reply");

// The headline says no greeting gets more visits than both other openings, in every model tier
// at least as many as the first name alone; the replies section says the openings do not differ.
const ALPHA = 0.05;
const ranked = (L) => [L.none, L.name, L.greet].sort((a, b) => b.rate - a.rate);
if (ranked(v)[0] !== v.none) throw new Error("no greeting no longer gets the most visits: rewrite the verdict");
for (const other of [v.name, v.greet]) if (pSame(v.none, other) >= ALPHA) throw new Error(`no greeting vs ${other.label}: no longer a measurable visit difference, rewrite the verdict`);
for (const [t, s] of Object.entries(v.tiers)) if (s.none.rate < s.name.rate && pSame(s.none, s.name) < ALPHA) throw new Error(`${t}: no greeting now measurably loses visits: rewrite the limits`);
if (ranked(v.tiers.Flash)[0] !== v.tiers.Flash.none) throw new Error("Flash: no greeting no longer leads on visits: rewrite the limits");
for (const [a, b] of [[r.none, r.name], [r.none, r.greet], [r.name, r.greet]]) if (pSame(a, b) < ALPHA) throw new Error(`replies: ${a.label} vs ${b.label} now differ measurably: rewrite the replies section`);

const BLUE = "#2563eb";
const PALE = "#93c5fd";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
// Method states one waiting rule for both legs, and the limits say every email predates the
// greeting requirement: hold the snapshot to both.
if (v.durationDays !== r.durationDays) throw new Error("the two legs wait different days: state both in Method");
if (!(v.cutoff < "2026-09-28" && r.cutoff < "2026-09-28")) throw new Error("the window reaches emails written under the greeting requirement: rewrite the limits");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const facts = {
  ...snap,
  v,
  r,
  total: { emails: v.totals.emails + r.totals.emails },
  // the day our templates started requiring a greeting (content-generation-service); every email
  // in the window was written before it, which the limits section states
  greetingRequiredSince: "2026-09-28",
  // the emails no opening could be read for, stated only when there are some
  leftOut: (() => {
    const n = v.noOpening + r.noOpening;
    return n > 0 ? `${commas(n)} ${n === 1 ? "email whose" : "emails whose"} first email text is not on record ${n === 1 ? "is" : "are"} left out.` : "";
  })(),
};

const round = (n) => commas(Math.round(Number(n) / 1000) * 1000);
const roundK = (n) => `${Math.round(Number(n) / 1000)}k`;
// a visit rate is a percent with one decimal; a positive reply is rare enough to read per 10,000 emails
const pct = (x) => `${(Number(x) * 100).toFixed(1)}%`;
const per10k = (x) => (Number(x) * 10000).toFixed(1);
// a lift under +50% reads as a percent, from there as a multiplier
const lift = (ratio) => (ratio < 1.5 ? `+${Math.round((ratio - 1) * 100)}%` : `x${ratio.toFixed(1)}`);

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

// The visit chart: one bar per opening, most visits first, the winner blue, counts under each.
// The replies get no chart: three bars of different lengths would read as a ranking the data
// does not hold.
function chart(legKey) {
  if (legKey !== "visit") throw new Error(`no chart for ${legKey}`);
  const T = LEG.visit;
  const rows = ranked(v);
  const title = "Share of emails that got a website visit, by greeting (higher is better)";
  const countLine = (s) => `${commas(s.outcomes)} ${s.outcomes === 1 ? T.noun : T.nouns}, ${commas(s.emails)} ${T.emails}`;
  const LEFT = gutterFor(rows.map((s) => s.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((s) => s.rate));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((s) => `${s.label} ${pct(s.rate)} (${countLine(s)})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((s, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((s.rate / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(s.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${i === 0 ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${pct(s.rate)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(countLine(s))}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">Only people we started writing to at least ${v.durationDays} days before the read count, with every ${T.noun} they made since.</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  round: (p) => round(get(p)),
  k: (p) => roundK(get(p)),
  raw: (p) => String(get(p)),
  day: (p) => day(get(p)),
  pct: (p) => pct(get(p)),
  per10k: (p) => per10k(get(p)),
  // {{lift a b}}: how many more visits opening a got than opening b, from their rates
  lift: (p) => {
    const [a, b] = p.split(/\s+/);
    return lift(get(a) / get(b));
  },
  chart,
};

const tpl = readFileSync(join(contentDir, SLUG, "article.template.html"), "utf8");
const html = tpl.replace(/\{\{(\w+)\s+([^}]*)\}\}/g, (whole, kind, rest) => {
  const h = HANDLERS[kind];
  if (!h) throw new Error(`unknown token: ${whole}`);
  return h(rest.trim());
});
if (html.includes("{{")) throw new Error(`${SLUG}: unresolved token`);
if (html.includes("—")) throw new Error(`${SLUG}: em-dash in copy`);
writeFileSync(join(contentDir, SLUG, "article.html"), html);
console.log(`${SLUG}: ${html.length} chars, ${facts.total.emails} emails`);
