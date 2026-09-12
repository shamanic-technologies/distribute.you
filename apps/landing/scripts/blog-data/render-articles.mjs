#!/usr/bin/env node
// Renders the two cold-email data articles from facts.json and their prose templates.
//
//   node render-articles.mjs <facts.json> <content-dir>
//
// A template is the prose. Every figure, every bar and every table cell is a token the
// renderer fills from facts.json, so no number on either page can be typed by hand and
// re-running extract.sh + derive.mjs + this script reproduces both articles.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "./chart-geometry.mjs";

const [factsPath, contentDir] = process.argv.slice(2);
if (!factsPath || !contentDir) throw new Error("usage: render-articles.mjs <facts.json> <content-dir>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));

const BLUE = "#2563eb";
const PALE = "#93c5fd";
const THIN = "#cbd5e1";

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}
const commas = (n) => Number(n).toLocaleString("en-US");
// a bucket can price an outcome below a dollar; "$0" would read as free
const usd = (n) => (Number(n) > 0 && Number(n) < 0.5 ? "under $1" : `$${commas(Math.round(Number(n)))}`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");


// Buckets arrive under the producer's own words; the page reads in the customer's.
const LABEL = {
  c_suite: "C-suite", director: "Director", entry: "Entry", founder: "Founder", head: "Head",
  manager: "Manager", owner: "Owner", vp: "VP", senior: "Senior", partner: "Partner", intern: "Intern",
  "link in the body": "A link in the body", "no link": "No link",
  // The producer names an industry as its taxonomy does; two of them are longer than any
  // gutter can carry without eating the bars, so the page reads them the short way.
  "information technology & services": "IT and services",
  "health, wellness & fitness": "Health and wellness",
};
// sentence case: a bucket reads as a phrase, not as a headline
const label = (b) => LABEL[b] || b.charAt(0).toUpperCase() + b.slice(1);

function args(spec) {
  const out = {};
  for (const part of spec.split("|")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function rowsOf(cutPath, { metric, min, drop, best }) {
  let rows = get(cutPath);
  if (!Array.isArray(rows)) throw new Error(`not a cut: ${cutPath}`);
  if (best) {
    // The tier rows say so in full, since the best-workflow rows now sit beside them, and
    // the chart ranks on the value it draws rather than keeping the tier order.
    rows = rows.map((r) => ({ ...r, bucket: `${r.bucket} tier, all workflows`, ordinal: false }));
    rows = [...BEST_ROWS[best](get("best")), ...rows];
  }
  if (drop) { const kill = drop.split(","); rows = rows.filter((r) => !kill.includes(r.bucket)); }
  // A row with no outcome cannot carry a cost bar, so it is left out rather than drawn empty.
  if (metric === "cpc") rows = rows.filter((r) => r.clicks > 0);
  if (metric === "cpr" || metric === "rate") rows = rows.filter((r) => r.replies > 0);
  if (min) rows = rows.filter((r) => r.emails >= Number(min));
  return rankRows(rows, metric);
}

// A CATEGORICAL cut (a role, an industry, a country) has no order of its own, so the chart ranks
// it on the value it draws: best first, which is cheapest on a cost chart and highest on a rate
// one. Alphabetical says nothing about the thing measured and reads as unordered. An ORDINAL cut
// (the sequence, a length band, an hour, a month) keeps the order derive declared, because any
// other order would state something false about it.
// A THIN row is priced on too few outcomes to be ranked on that price, so it sinks below every
// measured row and orders among the thin ones, the same rule a learning row follows everywhere.
function rankRows(rows, metric) {
  if (rows.some((r) => r.ordinal)) return rows;
  const field = metric === "rate" ? "repliesPerTenThousand" : metric;
  const thinField = metric === "rate" ? "cprThin" : `${metric}Thin`;
  const dir = metric === "rate" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const thin = Number(Boolean(a[thinField])) - Number(Boolean(b[thinField]));
    if (thin) return thin;
    return dir * (Number(a[field]) - Number(b[field]));
  });
}

const countLine = (r, metric) => {
  const counts =
    metric === "cpr" || metric === "rate"
      ? `${commas(r.replies)} positive ${r.replies === 1 ? "reply" : "replies"}, ${commas(r.emails)} emails`
      : `${r.clicksPerThousand} clicks per 1,000 emails, ${commas(r.emails)} emails`;
  // A best-workflow row is named by its tier and its model, never by its codename.
  return r.model ? `${r.model}: ${counts}` : counts;
};

// The two answer charts state our best workflow beside the tier it beats: a client is
// served the winner of the A/B test and never the tier's average, so a chart that draws
// only the average contradicts the paragraph above it.
function bestRow(best, which, metric) {
  const w = best[which];
  if (!w) throw new Error(`no best workflow for ${which}`);
  const linked = metric === "cpc";
  return {
    bucket: `Best ${w.tier} workflow`,
    model: w.model,
    cpc: w.cpc, cpr: w.cpr, cpcThin: w.cpcThin, cprThin: w.cprThin,
    repliesPerTenThousand: w.repliesPerTenThousand,
    replies: w.replies,
    clicks: linked ? w.linkedClicks : w.clicks,
    clicksPerThousand: linked ? w.linkedClicksPerThousand : w.clicksPerThousand,
    emails: linked ? w.linkedEmails : w.emails,
  };
}
const BEST_ROWS = {
  reply: (best) => [bestRow(best, "reply", "cpr")],
  visit: (best) => [bestRow(best, "visit", "cpc"), bestRow(best, "bestPricedPro", "cpc")],
};

function barChart(spec) {
  const a = args(spec);
  const metric = a.metric || "cpc";
  const rows = rowsOf(a.cut, { metric, min: a.min, drop: a.drop, best: a.best });
  if (!rows.length) throw new Error(`no rows to chart: ${a.cut}`);
  const field = metric === "rate" ? "repliesPerTenThousand" : metric;
  const thinField = metric === "rate" ? "cprThin" : `${metric}Thin`;
  const higherIsBetter = metric === "rate";
  const values = rows.map((r) => Number(r[field]));
  const max = Math.max(...values);
  const solid = values.filter((v, i) => !rows[i][thinField]);
  const best = solid.length ? (higherIsBetter ? Math.max(...solid) : Math.min(...solid)) : null;
  const show = (v) => (higherIsBetter ? String(v) : usd(v));
  const names = rows.map((r) => `${label(r.bucket)}${r[thinField] ? " (thin)" : ""}`);
  const LEFT = gutterFor(names);
  const W = BAR_END - LEFT;
  const height = chartHeight(rows.length, Boolean(a.note));
  const parts = [];
  const spoken = rows.map((r, i) => `${names[i]} ${show(r[field])}`).join(", ");
  parts.push(`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(a.title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`);
  parts.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(a.title)}</text>`);
  rows.forEach((r, i) => {
    const y = 56 + i * ROW;
    const v = Number(r[field]);
    const w = Math.max(6, Math.round((v / max) * W));
    const fill = r[thinField] ? THIN : v === best ? BLUE : PALE;
    parts.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(names[i])}</text>`);
    parts.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${fill}"/>`);
    parts.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${show(v)}</text>`);
    parts.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(countLine(r, metric))}</text>`);
  });
  if (a.note) parts.push(`<text x="0" y="${height - 8}" font-size="13" fill="#64748b">${esc(a.note)}</text>`);
  parts.push("</svg>");
  return `<figure>\n${parts.join("\n")}\n</figure>`;
}

function table(spec) {
  const a = args(spec);
  const metric = a.metric || "cpc";
  let rows = get(a.cut);
  if (a.drop) { const kill = a.drop.split(","); rows = rows.filter((r) => !kill.includes(r.bucket)); }
  const head = metric === "cpr"
    ? ["Bucket", "Emails", "Positive replies", "Per 10,000", "Spend", "Cost per positive reply"]
    : ["Bucket", "Emails", "Clicks", "Clicks per 1,000", "Spend", "Cost per click"];
  const body = rows.map((r) => {
    // a row under the floors is priced and labelled (thin), the same as its bar
    const thin = metric === "cpr" ? r.cprThin : r.cpcThin;
    const name = `${label(r.bucket)}${thin && (metric === "cpr" ? r.replies : r.clicks) ? " (thin)" : ""}`;
    const cells = metric === "cpr"
      ? [name, commas(r.emails), commas(r.replies), r.repliesPerTenThousand, usd(r.spend), r.replies ? usd(r.cpr) : "-"]
      : [name, commas(r.emails), commas(r.clicks), r.clicksPerThousand, usd(r.spend), r.clicks ? usd(r.cpc) : "-"];
    return `<tr>${cells.map((c, i) => `<td${i ? ' style="text-align:right"' : ""}>${esc(c)}</td>`).join("")}</tr>`;
  });
  return [
    `<h4>${esc(a.title)}</h4>`,
    '<div style="overflow-x:auto">',
    "<table>",
    `<thead><tr>${head.map((h, i) => `<th${i ? ' style="text-align:right"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body.join("")}</tbody>`,
    "</table>",
    "</div>",
  ].join("\n");
}

// One bucket of one cut, named rather than indexed: a cut can gain or lose a bucket
// as the data moves, and an index would then quietly read a different row.
function pick(spec) {
  const a = args(spec);
  const rows = get(a.cut);
  const row = rows.find((r) => r.bucket === a.bucket);
  if (!row) throw new Error(`no bucket "${a.bucket}" in ${a.cut}`);
  const v = row[a.field || "cpc"];
  if (v === null || v === undefined) throw new Error(`${a.cut} "${a.bucket}" has no ${a.field}`);
  return a.fmt === "usd" ? usd(v) : a.fmt === "n" ? commas(v) : String(v);
}

const HANDLERS = {
  pick,
  n: (p) => commas(get(p.trim())),
  usd: (p) => usd(get(p.trim())),
  raw: (p) => String(get(p.trim())),
  chart: barChart,
  table,
};

function render(template) {
  return template.replace(/\{\{(\w+)\s*([^}]*)\}\}/g, (whole, kind, rest) => {
    const h = HANDLERS[kind];
    if (!h) throw new Error(`unknown token: ${whole}`);
    return h(rest.replace(/^\|/, ""));
  });
}

for (const slug of ["cost-per-click-cold-email", "flash-vs-pro-llm-cold-email"]) {
  const tpl = readFileSync(join(contentDir, slug, "article.template.html"), "utf8");
  const html = render(tpl);
  if (html.includes("{{")) throw new Error(`${slug}: unresolved token`);
  if (html.includes("—")) throw new Error(`${slug}: em-dash in copy`);
  writeFileSync(join(contentDir, slug, "article.html"), html);
  console.log(`${slug}: ${html.length} chars`);
}
