#!/usr/bin/env node
// Renders the open-tracking article from its prose template and the derived facts.
//
//   node render-pixel-article.mjs <facts.json> <content-dir>
//
// Every figure, bar and table cell is a token filled from facts.json, so re-running
// extract-pixel.sh then derive-pixel.mjs reproduces the page.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "cold-email-open-tracking-pixel";
const [factsPath, contentDir] = process.argv.slice(2);
if (!factsPath || !contentDir) throw new Error("usage: render-pixel-article.mjs <facts.json> <content-dir>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));

const ON = "#94a3b8";
const OFF = "#2563eb";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
const rate = (x) => `${Number(x).toFixed(2)}%`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}
const cmp = (path) => {
  const c = get(path);
  if (typeof c?.liftPct !== "number") throw new Error(`not a comparison: ${path}`);
  return c;
};
const side = (path) => {
  const s = get(path);
  if (typeof s?.count !== "number") throw new Error(`not an arm: ${path}`);
  return s;
};
const signed = (n) => (n > 0 ? `+${n}%` : `${n}%`);

// Open tracking on sits above off: the order the reader lived it in.
function chart(spec) {
  const [path, ...titleParts] = spec.split("|");
  const c = cmp(path.trim());
  // the lift is printed in the title, so the verdict beside the chart quotes a value it shows
  const title = `${titleParts.join("|").trim()}: ${signed(c.liftPct)} without the pixel`;
  const rows = [
    { label: "Open tracking on", s: c.on, fill: ON },
    { label: "Open tracking off", s: c.off, fill: OFF },
  ];
  const LEFT = gutterFor(rows.map((r) => r.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((r) => r.s.pct));
  const height = chartHeight(rows.length, false);
  const count = (s) => `${commas(s.count)} of ${commas(s.of)} leads`;
  const spoken = rows.map((r) => `${r.label} ${rate(r.s.pct)} (${count(r.s)})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((r, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((r.s.pct / max) * W * 0.85));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(r.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${r.fill}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${rate(r.s.pct)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(count(r.s))}</text>`);
  });
  out.push("</svg>");
  return `<figure>\n${out.join("\n")}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p.trim())),
  raw: (p) => String(get(p.trim())),
  day: (p) => day(get(p.trim())),
  pct: (p) => rate(side(p.trim()).pct),
  of: (p) => { const s = side(p.trim()); return `${commas(s.count)} of ${commas(s.of)}`; },
  lift: (p) => signed(cmp(p.trim()).liftPct),
  p: (p) => cmp(p.trim()).p,
  chart,
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
