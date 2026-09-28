#!/usr/bin/env node
// Writes the committed snapshot the article `cold-email-response-rate` is rendered from.
//
//   node derive-naming.mjs <facts.json> > naming.snapshot.json
//
// Reads the same facts.json (and the templates.json extract.sh writes beside it) the Research
// page is built from, and puts every email on a side through naming.mjs, the module research.mjs
// uses for its `herald-naming-*` studies. So the article and the Research page state the same
// figures for the same extract. The snapshot carries aggregates only: no template text, no
// client, no lead, no campaign.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { namingSides } from "./naming.mjs";

const factsPath = process.argv[2];
if (!factsPath) throw new Error("usage: derive-naming.mjs <facts.json>");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
if (!facts.research?.reply) throw new Error("facts.json carries no research block: re-run derive.mjs");
const M = facts.maturation;
if (!M || !Number.isInteger(M.days) || !M.note) throw new Error("facts.json carries no maturation window: re-run derive.mjs");
const templateTexts = new Map(
  JSON.parse(readFileSync(join(dirname(factsPath), "templates.json"), "utf8")).map((t) => [t.type, t.prompt]),
);

// The positive-reply outcome, as research.mjs defines it (OUTCOMES.reply): the
// start_to_conversation leg, positive replies over emails, spend over positive replies.
const REPLY = { count: "replies", rate: "repliesPerTenThousand", cost: "cpr", per: 10000 };
const { held, named, silent, unrecorded } = namingSides(REPLY, facts.research.reply, templateTexts);
const side = (r) => ({ emails: r.emails, replies: r.replies, spend: r.spend, versions: r.versions });

const snapshot = {
  leg: "start_to_conversation",
  windowFrom: facts.window.from,
  windowEnd: M.windowEnd,
  readOn: facts.generatedAt.slice(0, 10),
  maturation: { days: M.days, percent: Math.round(M.percentile * 100), cutoff: M.cutoff, note: M.note },
  held: side(held),
  named: side(named),
  silentEmails: silent,
  unrecordedEmails: unrecorded,
};
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
