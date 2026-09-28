#!/usr/bin/env node
// Renders the article `cold-email-response-rate` from its prose template and the committed
// snapshot derive-naming.mjs writes.
//
//   node render-naming-article.mjs <naming.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here. The rates, prices and p-values are
// computed with naming.mjs, the same module the Research page's naming studies use.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";
import { NAMING_LABEL, rateP, costP, pText } from "./naming.mjs";

const SLUG = "cold-email-response-rate";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-naming-article.mjs <naming.snapshot.json> <content-dir>");
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));

const REPLY = { count: "replies", rate: "repliesPerTenThousand", cost: "cpr", per: 10000 };

// The same arithmetic as namingSides: a rate per 10,000 at two decimals, a price at cents.
function sideOf(k) {
  const s = snap[k];
  return {
    ...s,
    label: NAMING_LABEL[k],
    repliesPerTenThousand: Number(((s.replies / s.emails) * REPLY.per).toFixed(2)),
    cpr: s.replies ? Number((s.spend / s.replies).toFixed(2)) : null,
    perEmail: s.spend / s.emails,
  };
}
const held = sideOf("held");
const named = sideOf("named");

// The prose names the winner in words, so the renderer refuses a snapshot where it lost.
if (!(held.repliesPerTenThousand > named.repliesPerTenThousand)) throw new Error("the client-not-named side no longer has the higher rate: rewrite the verdict");
if (!(named.cpr === null || held.cpr < named.cpr)) throw new Error("the client-not-named side no longer has the cheaper positive reply: rewrite the verdict");

const facts = {
  ...snap,
  held,
  named,
  total: { emails: held.emails + named.emails, replies: held.replies + named.replies },
  p: { rate: pText(rateP(held, named, REPLY)), cost: pText(costP(held, named, REPLY)) },
  // the emails no side could take, stated only when there are some (as the Research page does)
  leftOut: [
    snap.silentEmails > 0 ? `${Number(snap.silentEmails).toLocaleString("en-US")} emails from templates whose prompt says neither are left out.` : "",
    snap.unrecordedEmails > 0 ? `${Number(snap.unrecordedEmails).toLocaleString("en-US")} emails whose template was not recorded are left out.` : "",
  ].filter(Boolean).join(" "),
};

const BLUE = "#2563eb";
const PALE = "#93c5fd";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
const usd = (n) => `$${commas(Math.round(Number(n)))}`;
const cents = (n) => `$${Number(n).toFixed(2)}`;
// A rate reads as a percent of emails, two decimals, as on the Research page.
const pct = (s) => `${(s.repliesPerTenThousand / 100).toFixed(2)}%`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
// the round volume a sentence leads with; the exact count lives under Method
const round = (n) => commas(Math.round(Number(n) / 1000) * 1000);

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}
const side = (path) => {
  const s = get(path);
  if (typeof s?.repliesPerTenThousand !== "number") throw new Error(`not a side: ${path}`);
  return s;
};

const countLine = (s) => `${commas(s.replies)} positive ${s.replies === 1 ? "reply" : "replies"}, ${commas(s.emails)} emails`;

// Two bars, the winner first and blue. Every bar prints its counts under it.
function chart(metric) {
  const rate = metric === "rate";
  const rows = [held, named].sort((a, b) => (rate ? b.repliesPerTenThousand - a.repliesPerTenThousand : a.cpr - b.cpr));
  const value = (s) => (rate ? s.repliesPerTenThousand : s.cpr);
  const show = (s) => (rate ? pct(s) : usd(s.cpr));
  const title = rate ? "Positive reply rate, % of emails (higher is better)" : "Cost per positive reply (USD, lower is better)";
  const LEFT = gutterFor(rows.map((r) => r.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map(value));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((r) => `${r.label} ${show(r)} (${countLine(r)})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((r, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((value(r) / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(r.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${i === 0 ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${show(r)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(countLine(r))}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">${esc(facts.maturation.note)}</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  round: (p) => round(get(p)),
  raw: (p) => String(get(p)),
  usd: (p) => usd(get(p)),
  cents: (p) => cents(get(p)),
  pct: (p) => pct(side(p)),
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
console.log(`${SLUG}: ${html.length} chars`);
