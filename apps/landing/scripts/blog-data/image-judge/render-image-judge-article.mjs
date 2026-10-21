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
const q = facts.byQuestion;
if (q.phone.kind !== "conclusion" || q.reviews.kind !== "conclusion") throw new Error("phone or reviews is no longer a conclusion: rewrite the headline");
if (q.address.kind !== "signal") throw new Error(`address is now ${q.address.kind}: rewrite "a lead to confirm"`);
if (q.phone.description !== 0 || q.reviews.description !== 0) throw new Error("the description now wins a phone or review disagreement: rewrite 'not once'");
if (facts.roof.imageRight !== facts.roof.judged) throw new Error("the image is no longer right on every judged roofer: rewrite 'every one'");
if (facts.coveredTotals.decided - facts.coveredTotals.agree !== 1) throw new Error("the covered questions no longer differ on exactly one answer: rewrite 'all but one'");

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

function chart(kind) {
  const r = facts.roof;
  const spec = {
    roofers: {
      title: `Right answers on ${r.judged} roofing homepages: "no phone in the header?"`,
      rows: [
        { label: "Asked on the screenshot", value: r.imageRight, display: `${r.imageRight} of ${r.judged}`, note: "the question asked of the image itself", lead: true },
        { label: "Asked on a description", value: r.descriptionRight, display: `${r.descriptionRight} of ${r.judged}`, note: "a model describes the page, the judge reads the text", lead: false },
      ],
      caption: "Same screenshots, same question, same judge (Jev 1.13). Every header checked by eye.",
    },
    disagreements: {
      title: "When the two ways disagreed, which answer was right",
      rows: [
        { label: "Phone in the header, screenshot", value: q.phone.image, display: `${q.phone.image}`, note: "times right", lead: true },
        { label: "Phone in the header, description", value: q.phone.description, display: `${q.phone.description}`, note: "times right", lead: false },
        { label: "Review rating, screenshot", value: q.reviews.image, display: `${q.reviews.image}`, note: "times right", lead: true },
        { label: "Review rating, description", value: q.reviews.description, display: `${q.reviews.description}`, note: "times right", lead: false },
      ],
      caption: `${facts.screenshots} company homepages from our clients' prospect lists, each disagreement checked by eye.`,
    },
  }[kind];
  if (!spec) throw new Error(`unknown chart: ${kind}`);
  const { title, rows } = spec;
  const LEFT = gutterFor(rows.map((x) => x.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((x) => x.value));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((x) => `${x.label} ${x.display} (${x.note})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((x, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((x.value / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(x.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${x.lead ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${esc(x.display)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(x.note)}</text>`);
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
console.log(`${SLUG}: ${html.length} chars, roofers ${facts.roof.descriptionRight}/${facts.roof.judged} -> ${facts.roof.imageRight}/${facts.roof.judged}, disagreements ${facts.pooled.image} vs ${facts.pooled.description}`);
