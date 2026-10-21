#!/usr/bin/env node
// Renders the article `ai-lead-qualification` from its prose template and the committed snapshot
// derive-image-judge.mjs writes.
//
//   node render-image-judge-article.mjs <image-judge.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here: the article divides nothing on its own.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "ai-lead-qualification";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-image-judge-article.mjs <image-judge.snapshot.json> <content-dir>");
const facts = JSON.parse(readFileSync(snapshotPath, "utf8"));

// The words in the prose, held to the snapshot: refuse one where they stop being true.
if (facts.anyDifference) throw new Error("a rival now differs from Jev beyond noise: rewrite 'no measurable difference'");
if (facts.cheapest.label !== facts.byKey.jev.label) throw new Error("Jev is no longer the cheapest: rewrite the price section");
if (facts.accuracy.min < 95) throw new Error("a model fell under 95 in 100: rewrite 'about 98 times in 100'");
if (facts.dearest.label !== facts.byKey["claude-sonnet"].label) throw new Error("Sonnet is no longer the dearest: rewrite the objection");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const BLUE = "#2563eb";
const PALE = "#93c5fd";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

const short = (label) => label.replace(/ \(.*\)$/, "");
function chart(kind) {
  const spec = {
    accuracy: {
      title: `Right answers per 100 website checks`,
      rows: [...facts.models].sort((a, b) => b.share - a.share).map((m) => ({ label: short(m.label), value: m.share * 100, display: m.per100Display, note: `95% interval ${m.ciLo} to ${m.ciHi}`, lead: m.key === "jev" })),
      caption: `${facts.screenshots} prospect homepages, ${facts.questions} qualification questions, same screenshot for every model. No model differs from Jev beyond chance.`,
    },
    price: {
      title: `Price per 1,000 website checks`,
      rows: [...facts.models].sort((a, b) => a.perThousand - b.perThousand).map((m) => ({ label: short(m.label), value: m.perThousand, display: m.perThousandDisplay, note: m.key === "jev" ? "the cheapest" : "", lead: m.key === "jev" })),
      caption: "What each check was billed at our catalogue prices, image included.",
    },
  }[kind];
  if (!spec) throw new Error(`unknown chart: ${kind}`);
  const { title, rows } = spec;
  const LEFT = gutterFor(rows.map((x) => x.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((x) => x.value));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((x) => `${x.label} ${x.display}${x.note ? ` (${x.note})` : ""}`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((x, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((x.value / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(x.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${x.lead ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${esc(x.display)}</text>`);
    if (x.note) out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(x.note)}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">${esc(spec.caption)}</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  raw: (p) => String(get(p)),
  day: (p) => day(get(p)),
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
console.log(`${SLUG}: ${html.length} chars, ${facts.models.map((m) => `${short(m.label)} ${m.per100}/100 ${m.perThousandDisplay}`).join(", ")}`);
