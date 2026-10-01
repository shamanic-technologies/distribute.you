#!/usr/bin/env node
// Renders the article `cold-email-follow-up` from its prose template and the committed snapshot
// derive-followups.mjs writes.
//
//   node render-followups-article.mjs <followups.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here, with the Research page's own arithmetic
// (research.mjs, follow-ups block): a depth adds up the spend and the positive replies of every
// email up to it, a rate divides by the people who got the first email, and a price is spend
// over positive replies.
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
const cost = (s) => Number((s.spend / s.replies).toFixed(2));
let spend = 0, got = 0;
const depth = sent.map((s, i) => {
  spend += s.spend; got += s.replies;
  return { label: i === 0 ? "First email only" : `+ ${i} follow-up${i > 1 ? "s" : ""}`, spend, got, per10k: Number(((got / people) * 10000).toFixed(1)) };
});
const total = depth[depth.length - 1].got;
// "doubled" and "under half" are words in the prose: refuse a snapshot where they stop being true.
if (total < 2 * first.replies) throw new Error("follow-ups no longer double the positive replies: rewrite the verdict");
// Each later email costs more per positive reply than the one before it, which the rule says.
if (!(cost(first) < cost(fu1) && cost(fu1) < cost(fu2))) throw new Error("the price per email no longer rises down the sequence: rewrite the rule");
if (snap.durationDays !== 21) throw new Error("the waiting rule changed: check Method");

const BLUE = "#2563eb";
const PALE = "#93c5fd";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const commas = (n) => Number(n).toLocaleString("en-US");
const usd = (n) => `$${commas(Math.round(Number(n)))}`;
const round = (n) => commas(Math.round(Number(n) / 1000) * 1000);
const roundK = (n) => `${Math.round(Number(n) / 1000)}k`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const replies = (n) => `${commas(n)} positive ${n === 1 ? "reply" : "replies"}`;

const facts = {
  ...snap,
  people,
  first: { ...first, cost: cost(first) },
  fu1: { ...fu1, cost: cost(fu1) },
  fu2: { ...fu2, cost: cost(fu2), sharePct: Math.round((fu2.replies / total) * 100) },
  total: { replies: total, emails: sent.reduce((t, s) => t + s.emails, 0) },
  // the rate chart's first and last bars, as printed on them
  rate: { first: depth[0].per10k.toFixed(1), all: depth[depth.length - 1].per10k.toFixed(1) },
  // the steps left out of the charts, stated only when there are some
  leftOut: dropped.length
    ? `We almost never send a third follow-up (${dropped.map((s) => `${commas(s.emails)} ${s.emails === 1 ? "email" : "emails"}`).join(", ")} in the window), so it is left out and this data says nothing about it.`
    : "",
};

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

// Two charts, both in sequence order (an ordinal cut keeps its order); the best bar is blue.
function bars({ title, rows, best }) {
  const LEFT = gutterFor(rows.map((r) => r.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((r) => r.value));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((r) => `${r.label} ${r.display} (${r.count})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  rows.forEach((r, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((r.value / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(r.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${i === best ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${esc(r.display)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(r.count)}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">Only people we started writing to at least ${snap.durationDays} days before the read count, with every positive reply they sent since. A reply counts for the last email sent before it.</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const CHARTS = {
  rate: () => bars({
    title: "Positive replies per 10,000 people, adding each follow-up (higher is better)",
    rows: depth.map((d) => ({ label: d.label, value: d.per10k, display: d.per10k.toFixed(1), count: `${replies(d.got)} from ${commas(people)} people` })),
    best: depth.length - 1,
  }),
  cost: () => bars({
    title: "Each email on its own: cost per positive reply (USD, lower is better)",
    rows: sent.map((s) => ({ label: s.bucket, value: cost(s), display: usd(cost(s)), count: `${replies(s.replies)}, ${commas(s.emails)} emails` })),
    best: 0,
  }),
};

const HANDLERS = {
  n: (p) => commas(get(p)),
  round: (p) => round(get(p)),
  k: (p) => roundK(get(p)),
  raw: (p) => String(get(p)),
  usd: (p) => usd(get(p)),
  day: (p) => day(get(p)),
  chart: (p) => { const c = CHARTS[p]; if (!c) throw new Error(`unknown chart: ${p}`); return c(); },
};

const meta = JSON.parse(readFileSync(join(contentDir, SLUG, "meta.json"), "utf8"));
if (!meta.title.includes(`(${roundK(facts.total.emails)} Emails)`)) throw new Error(`meta.title must end with (${roundK(facts.total.emails)} Emails)`);

const tpl = readFileSync(join(contentDir, SLUG, "article.template.html"), "utf8");
const html = tpl.replace(/\{\{(\w+)\s+([^}]*)\}\}/g, (whole, kind, rest) => {
  const h = HANDLERS[kind];
  if (!h) throw new Error(`unknown token: ${whole}`);
  return h(rest.trim());
});
if (html.includes("{{")) throw new Error(`${SLUG}: unresolved token`);
if (html.includes("—")) throw new Error(`${SLUG}: em-dash in copy`);
writeFileSync(join(contentDir, SLUG, "article.html"), html);
console.log(`${SLUG}: ${html.length} chars, ${facts.total.emails} emails, ${total} positive replies`);
