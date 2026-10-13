#!/usr/bin/env node
// Renders the article `gtm-ai-llm-judge` from its prose template and the committed snapshot
// derive-jev.mjs writes (the Research page's Typed judgment studies, copied verbatim).
//
//   node render-jev-article.mjs <jev.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here: the article divides nothing on its own.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "gtm-ai-llm-judge";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-jev-article.mjs <jev.snapshot.json> <content-dir>");
const facts = JSON.parse(readFileSync(snapshotPath, "utf8"));
// one client's case, read by jev/case.sql (committed beside it)
facts.case = JSON.parse(readFileSync(join(new URL(".", import.meta.url).pathname, "case.json"), "utf8"));

// The words in the prose, held to the snapshot: refuse one where they stop being true.
const pctOf = (s) => Number(String(s).replace("%", ""));
if (!(pctOf(facts.screen.display) >= 50)) throw new Error("the screen no longer turns away most people: rewrite 'most'");
if (!(pctOf(facts.machine.display) >= 50)) throw new Error("machines no longer write half the replies: rewrite 'half'");
if (!(pctOf(facts.screen.sure) >= 50)) throw new Error("Jev is no longer sure on most people: rewrite the bar section");

// Marketing copy speaks in natural frequencies ("1 lead in 4"), derived here, never typed.
const pct = (x) => Number(String(x).replace("%", ""));
facts.screen.keptOneIn = Math.round(100 / (100 - pct(facts.screen.display)));
facts.machine.oneIn = Math.round(100 / pct(facts.machine.display));
facts.screen.keptShare = `${100 - pct(facts.screen.display)}%`;
if (facts.screen.reachFloor < 2) throw new Error("the reach multiplier is under 2x: rewrite the value line");
if (facts.screen.keptOneIn !== 4) throw new Error(`the kept share now reads 1 in ${facts.screen.keptOneIn}: rewrite "1 lead in 4"`);
if (facts.machine.oneIn !== 2) throw new Error(`machine replies now read 1 in ${facts.machine.oneIn}: rewrite "1 reply in 2"`);

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

// Horizontal bars; the bars the prose is about are the strong blue.
function chart(kind) {
  const spec = {
    buckets: {
      title: "Cold filtered Apollo list, by Jev's probability that a person fits",
      rows: facts.screen.buckets,
      lead: (r) => /turned away/.test(r.note),
      caption: `Each person is judged once against the audience the client described, before any paid step. A person passes above 50%. Dark bars: turned away before the reveal.`,
    },
    replies: {
      title: "Replies to our cold emails, by who wrote them",
      rows: facts.machine.kinds,
      lead: (r) => r.label !== "A person",
      caption: "Every reply to our cold emails, labelled by our reply classifier. Dark bars: written by a machine.",
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
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(r.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${spec.lead(r) ? BLUE : PALE}"/>`);
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
console.log(`${SLUG}: ${html.length} chars, ${facts.volume.display} judgments, ${facts.screen.display} turned away, ${facts.price.display} cheaper, ${facts.machine.display} machine replies`);
