#!/usr/bin/env node
// Renders the opt-out footer article from its prose template and the derived facts.
//
//   node render-footer-article.mjs <facts.json> <content-dir>
//
// Every figure, bar and count line is a token filled from facts.json, so a re-read of the
// mailboxes (extract-footer.sh) followed by derive-footer.mjs reproduces the page.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "cold-email-unsubscribe-link-spam";
const [factsPath, contentDir] = process.argv.slice(2);
if (!factsPath || !contentDir) throw new Error("usage: render-footer-article.mjs <facts.json> <content-dir>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));

const RED = "#dc2626";
const PALE = "#fca5a5";
const CLEAN = "#2563eb";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}
const tallyAt = (path) => {
  const t = get(path);
  if (typeof t?.spam !== "number") throw new Error(`not a tally: ${path}`);
  return t;
};

// The arms are named in the reader's words, never the test's.
const ARM_LABEL = {
  link_header: "Visible link + header",
  no_footer: "No opt-out at all",
  body_only: "Body only, no signature",
  link_only: "Visible link, no header",
  header_only: "Header only",
  reply_stop: "Header + \"Reply stop\" line",
};

const countLine = (t, extra) =>
  [`${t.spam} of ${commas(t.arrived)} in spam`, extra, t.missing ? `${t.missing} never arrived` : null].filter(Boolean).join(", ");

// rows: [{ label, tally, extra }], ranked on the value drawn: least spam first.
function chart(title, rows) {
  rows = [...rows].sort((a, b) => a.tally.spamPct - b.tally.spamPct);
  const names = rows.map((r) => r.label);
  const LEFT = gutterFor(names);
  const W = BAR_END - LEFT;
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((r) => `${r.label} ${r.tally.spamPct}% (${countLine(r.tally)})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((r, i) => {
    const y = 56 + i * ROW;
    const pct = r.tally.spamPct;
    const w = Math.max(6, Math.round((pct / 100) * W));
    const fill = pct === 0 ? CLEAN : pct >= 40 ? RED : PALE;
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(r.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${fill}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${pct}%</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(countLine(r.tally, r.extra))}</text>`);
  });
  out.push("</svg>");
  return `<figure>\n${out.join("\n")}\n</figure>`;
}

function runChart(spec) {
  const [id, ...titleParts] = spec.split("|");
  const run = get(`runs.${id.trim()}`);
  const extra = `${run.senders} senders, ${run.receivers} inboxes`;
  return chart(titleParts.join("|").trim(), run.arms && Object.entries(run.arms).map(([arm, t]) => ({ label: ARM_LABEL[arm], tally: t, extra })));
}

const HANDLERS = {
  // "15 of 48": the count a spam share is taken over, always printed beside the share
  of: (p) => { const t = tallyAt(p.trim()); return `${t.spam} of ${commas(t.arrived)}`; },
  pct: (p) => `${tallyAt(p.trim()).spamPct}%`,
  n: (p) => commas(get(p.trim())),
  raw: (p) => String(get(p.trim())),
  runchart: runChart,
  summary: (title) => chart(title.trim(), [
    { label: "Visible unsubscribe link", tally: facts.visibleLink },
    { label: "No visible link", tally: facts.noVisibleLink },
  ]),
};

const tpl = readFileSync(join(contentDir, SLUG, "article.template.html"), "utf8");
const html = tpl.replace(/\{\{(\w+)\s+([^}]*)\}\}/g, (whole, kind, rest) => {
  const h = HANDLERS[kind];
  if (!h) throw new Error(`unknown token: ${whole}`);
  return h(rest);
});
if (html.includes("{{")) throw new Error(`${SLUG}: unresolved token`);
if (html.includes("—")) throw new Error(`${SLUG}: em-dash in copy`);
writeFileSync(join(contentDir, SLUG, "article.html"), html);
console.log(`${SLUG}: ${html.length} chars`);
