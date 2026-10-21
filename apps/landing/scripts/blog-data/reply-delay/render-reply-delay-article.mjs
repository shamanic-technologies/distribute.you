#!/usr/bin/env node
// Renders the article `cold-email-response-time` from its prose template and the committed
// snapshot fetch-reply-delay.sh writes (the Research study `positive-reply-delay`, as served).
//
//   node render-reply-delay-article.mjs <reply-delay.snapshot.json> <content-dir>
//
// Every figure is a token read off the served study: its counts, its displays, its headline and
// its conclusion lines. The only arithmetic here adds up served day bars into the two follow-up
// waves and divides them by the days they span. The headline claim is the study's CONCLUSION
// ("at least N%"); the waves and the median are stated as signals, exact figures in the notes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SLUG = "cold-email-response-time";
const [snapshotPath, contentDir] = process.argv.slice(2);
if (!snapshotPath || !contentDir) throw new Error("usage: render-reply-delay-article.mjs <reply-delay.snapshot.json> <content-dir>");
const { computedAt, study } = JSON.parse(readFileSync(snapshotPath, "utf8"));
if (study.id !== "positive-reply-delay") throw new Error(`wrong study: ${study.id}`);
if (study.verdict?.kind !== "conclusion") throw new Error(`the study is no longer a conclusion (${study.verdict?.kind}): rewrite the title and takeaway`);

const N = study.delay.sampleSize;
const [byDelay, byDay] = study.charts;
// "10 of 59 positive replies" is how the study states every bar's count.
const countOf = (chart, key) => {
  const p = chart.points.find((x) => x.key === key) ?? chart.curve?.points.find((x) => x.key === key);
  if (!p) throw new Error(`no bar ${key}`);
  const m = /^(\d+) of (\d+) positive replies$/.exec(p.note);
  if (!m || Number(m[2]) !== N) throw new Error(`unreadable count on ${key}: ${p.note}`);
  return Number(m[1]);
};
const curveOf = (key) => {
  const p = byDelay.curve.points.find((x) => x.key === key);
  if (!p) throw new Error(`no curve point ${key}`);
  return { count: countOf({ points: byDelay.curve.points }, key), display: p.display };
};
const stat = (key) => {
  const s = study.delay.stats.find((x) => x.key === key);
  if (!s) throw new Error(`no stat ${key}`);
  return s.display;
};

const floor = Number(/^At least (\d+)% of first positive replies arrive within 24 hours/.exec(study.headline)?.[1]);
if (!floor) throw new Error(`headline no longer states "at least N%": ${study.headline}`);
const range = /between (\d+)% and (\d+)% \(95% range\)/.exec(study.conclusion.join(" "));
if (!range) throw new Error("the conclusion no longer states the 95% range");
const sample = /^(\d+) positive replies · ([\d,]+) campaigns/.exec(study.result.sample);
if (!sample || Number(sample[1]) !== N) throw new Error(`unreadable sample: ${study.result.sample}`);

const day1 = curveOf("12h_1d");
const hour1 = curveOf("lt_1h");
const hour3 = curveOf("1h_3h");
const day2 = countOf(byDay, "day_2");
// The day-3 follow-up wave: days 3 to 5. The day-10 follow-up wave: 10 to 14 days, against the
// days around it (7 to 10 and 14 to 21 days).
const wave1 = countOf(byDay, "day_3") + countOf(byDay, "day_4") + countOf(byDay, "day_5");
const wave2 = countOf(byDelay, "10d_14d");
const wave2PerDay = wave2 / 4;
const aroundPerDay = (countOf(byDelay, "7d_10d") + countOf(byDelay, "14d_21d")) / (3 + 7);
const after30 = countOf(byDelay, "30d_60d") + countOf(byDelay, "60d_plus");
// Words in the prose: refuse a snapshot where they stop being true.
if (day2 !== 0) throw new Error("day 2 is no longer empty: rewrite the quiet-day paragraph");
if (!(wave1 > 0)) throw new Error("no reply after the day-3 follow-up: rewrite the first wave");
if (!(wave2PerDay >= 2 * aroundPerDay)) throw new Error("the 10 to 14 day wave no longer stands out: rewrite the second wave");
if (!(after30 > 0)) throw new Error("no reply after 30 days: rewrite the late-reply objection");
if (floor < 30) throw new Error("the floor fell under 30%: rewrite the title");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const facts = {
  readOn: computedAt,
  n: N,
  campaigns: sample[2],
  floor,
  low: Number(range[1]),
  high: Number(range[2]),
  day1,
  hour1,
  hour3,
  wave1,
  wave2,
  wave2PerDay: Math.round(wave2PerDay),
  aroundPerDay: Math.max(1, Math.round(aroundPerDay)),
  after30,
  median: stat("median"),
  average: stat("average"),
  p90: stat("p90"),
};

function get(path) {
  return path.split(".").reduce((o, k) => {
    if (o === undefined || o === null) throw new Error(`unknown path: ${path}`);
    const v = o[k];
    if (v === undefined) throw new Error(`unknown path: ${path}`);
    return v;
  }, facts);
}

// The waves, one column per day after the first email. No value is printed on a bar (exact
// counts live in the notes); three bands name the email each wave follows.
function chart() {
  const days = byDay.points;
  const max = Math.max(...days.map((p) => countOf(byDay, p.key)));
  const LEFT = 20, TOP = 116, H = 200, COL = 33, BAR = 25;
  const x = (i) => LEFT + i * COL;
  const title = "Positive replies by day after the first email";
  const spoken = days.map((p) => `${p.label} ${countOf(byDay, p.key)}`).join(", ");
  const out = [`<svg viewBox="0 0 800 380" width="100%" role="img" aria-label="${esc(title)}: ${esc(spoken)}" font-family="Inter, system-ui, sans-serif">`];
  out.push(`<text x="0" y="22" font-size="16" font-weight="600" fill="#0f172a">${esc(title)}</text>`);
  const band = (from, to, label, color, row) => {
    out.push(`<rect x="${x(from) - 4}" y="${TOP - 62}" width="${x(to) - x(from) + BAR + 8}" height="${H + 66}" rx="8" fill="${color}" fill-opacity="0.08"/>`);
    out.push(`<text x="${x(from)}" y="${TOP - 44 + row * 20}" font-size="12" font-weight="600" fill="${color}">${esc(label)}</text>`);
  };
  band(0, 0, "First email", "#1d4ed8", 0);
  band(2, 4, "Follow-up, day 3", "#0f766e", 1);
  band(10, 13, "Follow-up, day 10 (signal)", "#7c3aed", 0);
  days.forEach((p, i) => {
    const c = countOf(byDay, p.key);
    const h = c === 0 ? 2 : Math.max(6, Math.round((c / max) * H));
    const fill = i === 0 ? "#2563eb" : i >= 2 && i <= 4 ? "#14b8a6" : i >= 10 && i <= 13 ? "#8b5cf6" : "#cbd5e1";
    out.push(`<rect x="${x(i)}" y="${TOP + H - h}" width="${BAR}" height="${h}" rx="4" fill="${fill}"/>`);
  });
  const ticks = { 0: "1", 2: "3", 4: "5", 6: "7", 9: "10", 13: "14", 20: "21", 21: "21+" };
  for (const [i, t] of Object.entries(ticks)) out.push(`<text x="${x(Number(i)) + BAR / 2}" y="${TOP + H + 22}" font-size="12" fill="#64748b" text-anchor="middle">${t}</text>`);
  out.push(`<text x="${LEFT}" y="${TOP + H + 46}" font-size="12" fill="#94a3b8">Day after the first email</text>`);
  out.push("</svg>");
  const caption = `<figcaption style="color:#64748b;font-size:13px;line-height:1.5;margin-top:4px">Each bar is one day after the first email we sent a person. Day 1 is the first 24 hours. The last bar holds every reply after 21 days. Exact counts in the notes below.</figcaption>`;
  return `<figure style="margin:0 0 32px">\n${out.join("\n")}\n${caption}\n</figure>`;
}

// The notes table: the study's own buckets and displays, verbatim.
function table() {
  const rows = byDelay.points.map((p) => `<tr><td style="padding:4px 12px 4px 0">${esc(p.label)}</td><td style="padding:4px 0;text-align:right">${esc(p.display)}</td></tr>`);
  return `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:14px;margin:0 0 16px"><thead><tr><th style="text-align:left;padding:4px 12px 4px 0">Delay after the first message</th><th style="text-align:right;padding:4px 0">Share of first positive replies (count)</th></tr></thead><tbody>\n${rows.join("\n")}\n</tbody></table></div>`;
}

const HANDLERS = {
  raw: (p) => String(get(p)),
  day: (p) => day(get(p)),
  chart: () => chart(),
  table: () => table(),
};

const tpl = readFileSync(join(contentDir, SLUG, "article.template.html"), "utf8");
const html = tpl.replace(/\{\{(\w+)\s*([^}]*)\}\}/g, (whole, kind, rest) => {
  const h = HANDLERS[kind];
  if (!h) throw new Error(`unknown token: ${whole}`);
  return h(rest.trim());
});
if (html.includes("{{")) throw new Error(`${SLUG}: unresolved token`);
if (html.includes("—") || html.includes("–")) throw new Error(`${SLUG}: dash in copy`);
writeFileSync(join(contentDir, SLUG, "article.html"), html);
console.log(`${SLUG}: ${html.length} chars, at least ${floor}% within 24h (${day1.count} of ${N}), waves ${wave1} then ${wave2}`);
