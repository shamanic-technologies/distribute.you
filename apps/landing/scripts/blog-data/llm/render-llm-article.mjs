#!/usr/bin/env node
// Renders the article `best-llm-for-cold-email` from its prose template and the committed snapshot
// derive-llm.mjs writes.
//
//   node render-llm-article.mjs <llm.snapshot.json> <content-dir>
//
// Every figure, bar and count is a token filled here. The models ran for different clients in
// different months, so a crude per-model rate mostly measures the client mix. The article
// therefore compares Flash with Pro ONLY on the same client in the same month (like-for-like.mjs,
// the same pooling the Research page prints). The headline is marketing, the small print sits at
// the bottom, and neither may say something the data does not hold: the renderer refuses a
// snapshot where Flash stops matching Pro on visits, stops being cheaper per visit (also with the
// sequence step held fixed), or where the positive replies start to differ.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW, BAR_END, chartHeight, gutterFor } from "../chart-geometry.mjs";
import { likeForLike } from "../like-for-like.mjs";

const SLUG = "best-llm-for-cold-email";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-llm-article.mjs <llm.snapshot.json> <content-dir>");
const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));

const unflat = (pairs) => pairs.map((p) => p.map(([emails, outcomes, spend]) => ({ emails, outcomes, spend })));
const pooled = (pairs) => likeForLike(unflat(pairs));
// a ratio on fewer outcomes than this on one side spans orders of magnitude: the article prints
// counts instead, as the Research page does
const MIN_SIDE = 5;

const v = { ...snap.visit, tier: pooled(snap.visit.tier), tierStep: pooled(snap.visit.tierStep) };
const r = { ...snap.reply, tier: pooled(snap.reply.tier) };

// --- the claims the copy makes, held to the data ---
if (!v.tier.rate) throw new Error("visits: no like-for-like ratio");
if (!(v.tier.rate.lo < 1 && v.tier.rate.hi > 1)) throw new Error("visits: Flash and Pro now differ measurably like for like: rewrite the verdict");
if (!(v.tier.cost.hi < 1)) throw new Error("visits: Flash is no longer measurably cheaper per visit: rewrite the verdict");
if (!(v.tierStep.cost.hi < 1)) throw new Error("visits: with the step held fixed, Flash is no longer measurably cheaper per visit: rewrite the notes");
if (v.tier.a.outcomes < MIN_SIDE || v.tier.b.outcomes < MIN_SIDE) throw new Error("visits: too few on one side for a ratio");
if (r.tier.rate && r.tier.a.outcomes >= MIN_SIDE && r.tier.b.outcomes >= MIN_SIDE && !(r.tier.rate.lo < 1 && r.tier.rate.hi > 1)) throw new Error("replies: Flash and Pro now differ measurably: rewrite the replies section");
if (v.durationDays !== r.durationDays) throw new Error("the two legs wait different days: state both in Method");
// "half the cost" in the title must survive the interval
const halfOk = v.tier.cost.lo <= 0.5 && v.tier.cost.hi >= 0.5;
if (!halfOk) throw new Error(`visits: cost ratio ${v.tier.cost.ratio.toFixed(2)} no longer reads "half": rewrite the title`);

const commas = (n) => Number(n).toLocaleString("en-US");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const x1 = (ratio) => `x${ratio.toFixed(1)}`;
const x2 = (ratio) => `${ratio.toFixed(2)}x`;
const less = (ratio) => `-${Math.round((1 - ratio) * 100)}%`;
const index = (ratio) => String(Math.round(ratio * 100));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

// One line per Flash model held to the Pro reference, for the notes: a ratio when both sides have
// enough visits, the counts otherwise.
function modelLines(L, noun, nouns) {
  return L.models
    .map((m) => {
      const c = pooled(m.pairs);
      const tally = `${commas(c.a.outcomes)} ${c.a.outcomes === 1 ? noun : nouns} in ${commas(c.a.emails)} emails against ${commas(c.b.outcomes)} in ${commas(c.b.emails)}`;
      if (!c.rate || c.a.outcomes < MIN_SIDE || c.b.outcomes < MIN_SIDE) return `<li>${esc(m.label)}: ${tally}, too few for a ratio.</li>`;
      return `<li>${esc(m.label)}: ${x2(c.rate.ratio)} the ${nouns} per email (${x2(c.rate.lo)} to ${x2(c.rate.hi)}), a ${noun} at ${x2(c.cost.ratio)} the cost (${x2(c.cost.lo)} to ${x2(c.cost.hi)}); ${tally}.</li>`;
    })
    .join("\n");
}

const facts = {
  ...snap,
  v,
  r,
  // what share of each tier's emails the like-for-like comparison keeps
  kept: { emails: v.tier.a.emails + v.tier.b.emails, all: v.all.Flash.emails + v.all.Pro.emails },
  // the Pro side named: one model, or "our Pro models"
  proSide: v.proModels.length === 1 ? `${v.proModels[0]}, the only Pro model that wrote emails with a link in this window` : "our Pro models",
};

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    return o[k];
  }, facts);
}

// Two charts, symmetric: Pro = 100 on each, Flash beside it. One reads website visits per email,
// the other the cost per website visit, both on the same clients in the same months.
const BLUE = "#2563eb";
const PALE = "#93c5fd";
function chart(kind) {
  const c = v.tier;
  const spec = {
    visits: { title: "Website visits per email, same clients and months (Pro = 100, higher is better)", flash: c.rate.ratio },
    cost: { title: "Cost per website visit, same clients and months (Pro = 100, lower is better)", flash: c.cost.ratio },
  }[kind];
  if (!spec) throw new Error(`no chart ${kind}`);
  const rows = [
    { label: "Flash models", value: spec.flash, note: `${commas(c.a.outcomes)} website visits, ${commas(c.a.emails)} emails with a link` },
    { label: v.proModels.length === 1 ? v.proModels[0] : "Pro models", value: 1, note: `${commas(c.b.outcomes)} website visits, ${commas(c.b.emails)} emails with a link` },
  ];
  const best = kind === "cost" ? (spec.flash < 1 ? 0 : 1) : spec.flash > 1 ? 0 : 1;
  const LEFT = gutterFor(rows.map((s) => s.label));
  const W = BAR_END - LEFT;
  const max = Math.max(...rows.map((s) => s.value));
  const height = chartHeight(rows.length, false);
  const spoken = rows.map((s) => `${s.label} ${index(s.value)} (${s.note})`).join(", ");
  const out = [`<svg viewBox="0 0 800 ${height}" width="100%" role="img" aria-label="${esc(spec.title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(spec.title)}</text>`);
  rows.forEach((s, i) => {
    const y = 56 + i * ROW;
    const w = Math.max(6, Math.round((s.value / max) * W));
    out.push(`<text x="0" y="${y + 18}" font-size="14" fill="#475569">${esc(s.label)}</text>`);
    out.push(`<rect x="${LEFT}" y="${y}" width="${w}" height="26" rx="5" fill="${i === best ? BLUE : PALE}"/>`);
    out.push(`<text x="${LEFT + w + 10}" y="${y + 19}" font-size="16" font-weight="700" fill="#0f172a">${index(s.value)}</text>`);
    out.push(`<text x="${LEFT}" y="${y + 39}" font-size="11" fill="#94a3b8">${esc(s.note)}</text>`);
  });
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">Only a client's emails from a month in which both a Flash and a Pro model wrote for that client count, and only people we started writing to at least ${v.durationDays} days before the read.</figcaption>`;
  return `<figure>\n${out.join("\n")}\n${caption}\n</figure>`;
}

const HANDLERS = {
  n: (p) => commas(get(p)),
  k: (p) => `${Math.round(Number(get(p)) / 1000)}k`,
  raw: (p) => String(get(p)),
  day: (p) => day(get(p)),
  x1: (p) => x1(get(p)),
  x2: (p) => x2(get(p)),
  less: (p) => less(get(p)),
  index: (p) => index(get(p)),
  share: (p) => {
    const [a, b] = p.split(/\s+/);
    return `${Math.round((get(a) / get(b)) * 100)}%`;
  },
  models: (p) => (p === "visit" ? modelLines(v, "website visit", "website visits") : modelLines(r, "positive reply", "positive replies")),
  chart,
};

const tpl = readFileSync(join(contentDir, SLUG, "article.template.html"), "utf8");
const html = tpl.replace(/\{\{(\w+)\s+([^}]*)\}\}/g, (whole, kind, rest) => {
  const h = HANDLERS[kind];
  if (!h) throw new Error(`unknown token: ${whole}`);
  return h(rest.trim());
});
if (html.includes("{{")) throw new Error(`${SLUG}: unresolved token`);
if (html.includes("—") || html.includes("–")) throw new Error(`${SLUG}: dash in copy`);
writeFileSync(join(contentDir, SLUG, "article.html"), html);
console.log(`${SLUG}: ${html.length} chars, visits Flash/Pro ${x2(v.tier.rate.ratio)}, cost per visit ${x2(v.tier.cost.ratio)}`);
