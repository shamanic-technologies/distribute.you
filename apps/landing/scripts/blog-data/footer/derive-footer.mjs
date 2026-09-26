#!/usr/bin/env node
// Derives every figure the opt-out footer article states from the placement snapshot.
//
//   node derive-footer.mjs placement.snapshot.json > /tmp/footer-facts.json
//
// A share is spam over the messages that ARRIVED (inbox + spam). A message found in
// neither folder is "missing": its send was refused or it never arrived, so it says
// nothing about where the footer put it. Missing counts are carried so the page can
// state them rather than fold them into either side.
import { readFileSync } from "node:fs";

const snap = JSON.parse(readFileSync(process.argv[2] ?? new URL("./placement.snapshot.json", import.meta.url), "utf8"));
const VISIBLE_LINK = new Set(["link_header", "link_only"]);

const tally = (rows) => {
  const t = { inbox: 0, spam: 0, missing: 0 };
  for (const r of rows) t[r.place]++;
  t.arrived = t.inbox + t.spam;
  t.sent = t.arrived + t.missing;
  t.spamPct = t.arrived ? Math.round((t.spam / t.arrived) * 100) : null;
  return t;
};

const runs = {};
for (const run of snap.runs) {
  const rows = snap.rows.filter((r) => r.run === run.id);
  const arms = {};
  for (const arm of run.arms) arms[arm] = tally(rows.filter((r) => r.arm === arm));
  runs[run.id] = { ...run, pairs: rows.length, arms };
}

const all = snap.rows;
const facts = {
  readAt: snap.readAt.slice(0, 10),
  runs,
  // every email that carried the visible unsubscribe link, against every one that did not
  visibleLink: tally(all.filter((r) => VISIBLE_LINK.has(r.arm))),
  noVisibleLink: tally(all.filter((r) => !VISIBLE_LINK.has(r.arm))),
  total: tally(all),
  senders: snap.runs.reduce((n, r) => n + r.senders, 0),
};
if (facts.total.sent !== all.length) throw new Error("tally does not cover every pair");
console.log(JSON.stringify(facts, null, 1));
