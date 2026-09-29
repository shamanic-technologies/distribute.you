#!/usr/bin/env node
// Renders the article `cold-email-greeting` from its prose template and the committed snapshot
// derive-greeting.mjs writes.
//
//   node render-greeting-article.mjs <greeting.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here, with the Research page's own arithmetic:
// a price is spend over outcomes, and a bucket with fewer outcomes than its leg requires
// (features-service's `outcomesRequired`) is drawn and marked thin, never hidden.
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

function sideOf(legKey, row, required) {
  const L = LEG[legKey];
  const outcomes = row[L.count];
  return {
    label: row.bucket,
    emails: row.emails,
    outcomes,
    spend: row.spend,
    cost: outcomes ? Number((row.spend / outcomes).toFixed(2)) : null,
    // a percent of emails, one decimal for visits, three for the much rarer positive reply
    rate: `${((outcomes / row.emails) * 100).toFixed(legKey === "visit" ? 1 : 3)}%`,
    thin: outcomes < required,
  };
}
function legOf(legKey) {
  const l = snap[legKey];
  const named = (rows) => {
    const out = {};
    for (const r of rows) {
      const k = KEY[r.bucket];
      if (!k) throw new Error(`unknown opening bucket: ${r.bucket}`);
      out[k] = sideOf(legKey, r, l.outcomesRequired);
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

// The prose names the winners in words, so the renderer refuses a snapshot where they changed.
const winner = (L) => Object.entries({ none: L.none, name: L.name, greet: L.greet }).sort((a, b) => a[1].cost - b[1].cost)[0][0];
if (winner(v) !== "none") throw new Error("no greeting no longer wins on website visits: rewrite the verdict");
if (winner(r) !== "greet") throw new Error("greeting + first name no longer wins on positive replies: rewrite the verdict");
if (v.none.thin || r.greet.thin) throw new Error("a winning bucket is thin: rewrite the verdict");
// The limits section says which tier carries the visit result; hold it to that.
const tierWin = (L, t) => Object.entries(L.tiers[t] || {}).filter(([, s]) => s.cost !== null).sort((a, b) => a[1].cost - b[1].cost)[0];
if (tierWin(v, "Flash")?.[0] !== "none") throw new Error("the Flash tier no longer carries the no-greeting visit win: rewrite the limits");
if (tierWin(v, "Pro")?.[0] !== "greet" || !v.tiers.Pro.greet.thin) throw new Error("the Pro tier's cheapest visit is no longer a thin greeting + first name: rewrite the limits");

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

const usd = (n) => `$${commas(Math.round(Number(n)))}`;
const round = (n) => commas(Math.round(Number(n) / 1000) * 1000);
const roundK = (n) => `${Math.round(Number(n) / 1000)}k`;

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

// One chart per leg, cheapest first, the winner blue. Every bucket is a bar with its counts under
// it; a thin one says so in its label.
function chart(legKey) {
  const L = legKey === "visit" ? v : r;
  const T = LEG[legKey];
  const rows = [L.none, L.name, L.greet].sort((a, b) => a.cost - b.cost);
  const title = `Cost per ${T.noun} by greeting (USD, lower is better)`;
  const label = (s) => `${s.label}${s.thin ? " (thin)" : ""}`;
  const countLine = (s) => `${commas(s.outcomes)} ${s.outcomes === 1 ? T.noun : T.nouns}, ${commas(s.emails)} ${T.emails}`;
  const LEFT = gutterFor(rows.map(label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((s) => s.cost));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((s) => `${label(s)} ${usd(s.cost)} (${countLine(s)})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((s, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((s.cost / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(label(s))}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${i === 0 ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${usd(s.cost)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(countLine(s))}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">Only people we started writing to at least ${L.durationDays} days before the read count, with every ${T.noun} they sent since. A bucket with fewer than ${L.outcomesRequired} ${L.outcomesRequired === 1 ? T.noun : T.nouns} is marked thin.</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  round: (p) => round(get(p)),
  k: (p) => roundK(get(p)),
  raw: (p) => String(get(p)),
  usd: (p) => usd(get(p)),
  day: (p) => day(get(p)),
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
