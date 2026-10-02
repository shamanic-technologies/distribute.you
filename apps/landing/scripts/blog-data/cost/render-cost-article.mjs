#!/usr/bin/env node
// Renders the article `cold-email-cost-per-positive-reply` from its prose template and the
// committed snapshot derive-cost.mjs writes.
//
//   node render-cost-article.mjs <cost.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here from the snapshot, which copies the Research
// page's two average-cost studies verbatim: the article divides nothing on its own. The answer is
// the average since inception (everything spent over every positive reply); the months are context.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "cold-email-cost-per-positive-reply";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-cost-article.mjs <cost.snapshot.json> <content-dir>");
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
const { reply, visit } = snap;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const longMonth = (label) => {
  const i = SHORT.indexOf(label);
  if (i < 0) throw new Error(`unknown month label: ${label}`);
  return MONTHS[i];
};

// The words in the prose, held to the snapshot: refuse one where they stop being true.
const first = reply.running[0];
const last = reply.running.at(-1);
if (last.display !== reply.average.display) throw new Error("the running average's last point is not the headline average");
if (!(last.value > first.value)) throw new Error("the running average no longer rose since the first month: rewrite the answer");
if (!(reply.interval.lo < reply.average.value && reply.average.value < reply.interval.hi)) throw new Error("the average sits outside its own interval");
const byValue = [...reply.months].sort((a, b) => a.value - b.value);
const cheapest = byValue[0];
const dearest = byValue.at(-1);
// the prose tells the reader to read the average, "not the latest month": hold that the latest
// month is the dearest, the case the sentence is written for
if (dearest !== reply.months.at(-1)) throw new Error("the dearest month is no longer the latest: rewrite the month section");
if (snap.durationDays !== 21) throw new Error("the waiting rule changed: check the notes");

const BLUE = "#2563eb";
const PALE = "#93c5fd";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const monthOf = (ym) => { const [y, m] = String(ym).split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

const facts = {
  ...snap,
  firstRunning: { ...first, name: longMonth(first.label) },
  cheapestMonth: { ...cheapest, name: longMonth(cheapest.label) },
  dearestMonth: { ...dearest, name: longMonth(dearest.label) },
};

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

// One horizontal bar per month, in calendar order (an ordinal cut keeps its order).
function chart(kind) {
  const spec = {
    running: {
      title: "Cost per positive reply, average since April (lower is better)",
      rows: reply.running.map((p) => ({ label: `Through ${longMonth(p.label)}`, value: p.value, display: p.display, note: p.note })),
      caption: "Each bar divides everything spent since the first email by every positive reply since, up to that month.",
    },
    months: {
      title: "Cost per positive reply, month by month (lower is better)",
      rows: reply.months.map((p) => ({ label: longMonth(p.label), value: p.value, display: p.display, note: p.note })),
      caption: "Each bar prices one month of emails on its own. A month with few positive replies swings a long way.",
    },
  }[kind];
  if (!spec) throw new Error(`unknown chart: ${kind}`);
  const { title, rows } = spec;
  const LEFT = gutterFor(rows.map((r) => r.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((r) => r.value));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((r) => `${r.label} ${r.display} (${r.note})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((r, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((r.value / max) * W));
    const lead = kind === "running" ? i === rows.length - 1 : false;
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(r.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${lead ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${esc(r.display)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(r.note)}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">${esc(spec.caption)}</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  raw: (p) => String(get(p)),
  // whole dollars, the way the prose states a price
  dollars: (p) => `$${Math.round(Number(get(p)))}`,
  // two decimals, for the notes only
  cents: (p) => `$${Number(get(p)).toFixed(2)}`,
  day: (p) => day(get(p)),
  month: (p) => monthOf(get(p)),
  chart: (p) => chart(p),
};

const tpl = readFileSync(join(contentDir, SLUG, "article.template.html"), "utf8");
const html = tpl.replace(/\{\{(\w+)\s+([^}]*)\}\}/g, (whole, kind, rest) => {
  const h = HANDLERS[kind];
  if (!h) throw new Error(`unknown token: ${whole}`);
  return h(rest.trim());
});
if (html.includes("{{")) throw new Error(`${SLUG}: unresolved token`);
if (/[—–]/.test(html)) throw new Error(`${SLUG}: em-dash or en-dash in copy`);
writeFileSync(join(contentDir, SLUG, "article.html"), html);
console.log(`${SLUG}: ${html.length} chars, ${reply.average.display} per positive reply (${reply.interval.lo} to ${reply.interval.hi}), ${visit.average.display} per website visit`);
