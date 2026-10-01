#!/usr/bin/env node
// Renders the article `cold-email-follow-up` from its prose template and the committed snapshot
// derive-followups.mjs writes.
//
//   node render-followups-article.mjs <followups.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here, with the Research page's own arithmetic
// (research.mjs, follow-ups block): a depth adds up the positive replies of every email up to it
// and a rate divides by the people who got the first email. The answer is stated as a lift
// (x2, +67%); the counts behind it go to the notes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";

const SLUG = "cold-email-follow-up";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-followups-article.mjs <followups.snapshot.json> <content-dir>");
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));

// A step we barely send is left out of the charts and stated in the limits instead.
const MIN_EMAILS = 200;
const ORDER = ["First email", "Follow-up 1", "Follow-up 2", "Follow-up 3"];
for (const s of snap.steps) if (!ORDER.includes(s.bucket)) throw new Error(`unknown step: ${s.bucket}`);
const sent = snap.steps.filter((s) => s.emails >= MIN_EMAILS).sort((a, b) => ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket));
const dropped = snap.steps.filter((s) => s.emails < MIN_EMAILS);
// The prose speaks of the first email and two follow-ups: hold the snapshot to exactly that.
if (sent.map((s) => s.bucket).join("|") !== "First email|Follow-up 1|Follow-up 2") throw new Error("the steps sent are no longer the first email + two follow-ups: rewrite the article");
if (sent.some((s) => s.replies < snap.outcomesRequired)) throw new Error("a step has fewer positive replies than the leg requires: rewrite the verdict");

const [first, fu1, fu2] = sent;
const people = first.emails;
let got = 0;
const depth = sent.map((s, i) => {
  got += s.replies;
  return { label: i === 0 ? "First email only" : `+ ${i} follow-up${i > 1 ? "s" : ""}`, got, per10k: Number(((got / people) * 10000).toFixed(1)) };
});
const total = depth[depth.length - 1].got;
// The answer is a relative effect: each follow-up's lift over what the sequence had before it,
// and the whole sequence against the first email alone.
const pct = (a, b) => Math.round((a / b - 1) * 100);
const lift1 = pct(depth[1].got, depth[0].got);
const lift2 = pct(depth[2].got, depth[1].got);
const mult = (total / first.replies).toFixed(1);
// "doubled" and "smaller second lift" are words in the prose: refuse a snapshot where they stop being true.
if (total < 2 * first.replies) throw new Error("follow-ups no longer double the positive replies: rewrite the verdict");
if (!(lift1 > lift2 && lift2 > 0)) throw new Error("the second follow-up no longer adds less than the first, or adds nothing: rewrite the rule");
if (snap.durationDays !== 21) throw new Error("the waiting rule changed: check Method");

const BLUE = "#2563eb";
const PALE = "#93c5fd";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
const round = (n) => commas(Math.round(Number(n) / 1000) * 1000);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

const facts = {
  ...snap,
  people,
  lift1,
  lift2,
  mult,
  first,
  fu1,
  fu2,
  depth,
  total: { replies: total, emails: sent.reduce((t, s) => t + s.emails, 0) },
  // the steps left out of the chart, stated only when there are some
  leftOut: dropped.length
    ? `We almost never send a third follow-up (${dropped.map((s) => `${commas(s.emails)} ${s.emails === 1 ? "email" : "emails"}`).join(", ")} in the window), so this data says nothing about it.`
    : "",
};

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

// One chart in sequence order (an ordinal cut keeps its order): positive replies against the
// first email alone, the full sequence blue.
function chart() {
  const title = "Positive replies, against the first email alone (higher is better)";
  const rows = depth.map((d, i) => ({
    label: d.label,
    value: d.got / first.replies,
    display: `x${(d.got / first.replies).toFixed(1)}`,
    note: i === 0 ? "the baseline" : i === 1 ? `+${lift1}% over the first email alone` : `+${lift2}% over one follow-up`,
  }));
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
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${i === rows.length - 1 ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${esc(r.display)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(r.note)}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">The same people at every step. A reply counts for the last email sent before it. Counts in the notes below.</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  round: (p) => round(get(p)),
  raw: (p) => String(get(p)),
  day: (p) => day(get(p)),
  chart: () => chart(),
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
console.log(`${SLUG}: ${html.length} chars, x${mult}, +${lift1}% then +${lift2}%`);
