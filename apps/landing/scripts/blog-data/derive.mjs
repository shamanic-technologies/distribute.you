#!/usr/bin/env node
// Derives every figure in the two cold-email data articles from the dumps extract.sh pulls.
//
//   node derive.mjs /tmp/blog-data > /tmp/blog-data/facts.json
//
// Definitions, all of them stated in each article's own Method section:
//  - an EMAIL is one email_sent event on a sales-cold-email-outreach sequence row
//  - a CLICK is the first tracked link click a person made, attributed to the step the
//    provider named; self-send clicks reach this table only after the scanner classifier
//    promotes them, so link-scanner prefetches are already excluded
//  - a POSITIVE REPLY is the frozen classification on the sequence row, attributed to the
//    last email sent at or before the inbound message
//  - SPEND is what the client is charged, per workflow, before per-account discounts; each
//    email carries its own workflow's cost per email, so a bucket's spend is the sum over it
//  - a bucket is PRICED only past the floors below
//
// The RESEARCH block (dashboard v2) is scoped tighter than the articles: every figure is computed
// over ONE leg of the channel (campaign-service's leg_key), and a (workflow version, leg) is priced
// on its OWN spend, windowed on the same days as the emails it divides. The articles stay
// fleet-wide on purpose; nothing below the research section touches their figures.
import { openSync, readSync, closeSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isMature, maturationCutoff, maturationNote, measureMaturation, toMs } from "./maturation.mjs";
import { MODEL_LABEL } from "./model-label.mjs";

const dir = process.argv[2];
if (!dir) throw new Error("usage: derive.mjs <dump-dir>");
// The window's END is the moment outcomes stop being observed: a click or a reply after it does
// not count, and the maturation window is measured back from it. extract.sh writes it.
const WINDOW = JSON.parse(readFileSync(join(dir, "window.json"), "utf8"));
if (!/^\d{4}-\d{2}-\d{2}$/.test(WINDOW.to || "")) throw new Error(`window.json carries no end: ${JSON.stringify(WINDOW)}`);
const windowEndMs = toMs(`${WINDOW.to} 00:00:00`);

// A bucket is THIN when a reader should weigh the counts printed beside it rather than take its
// price as a rate. The bar is the SEND VOLUME first: ten emails says nothing, a few hundred
// starts to, and a thousand is an ordinary week for one campaign. These were ten times stricter
// and covered both pages in `(thin)` on buckets of seven hundred and a thousand emails, which
// reads as a study with nothing solid in it. Owner-set 2026-09-12: "700 ou 1k CEST PAS THIN ...
// ça serait thin si tu avais envoyé 10 emails ... 100+ ça commence à devenir sérieux".
const MIN_EMAILS = 100;
const MIN_CLICKS = 2;
const MIN_REPLIES = 1;

// Which workflow we PUT ON THE PAGE as our best is a different question from whether a bucket's
// price is readable, so it keeps the strict floors: the contest is decided by the CHEAPEST price
// among the workflows that clear them, and a workflow with two lucky replies prices far below one
// that has earned its number over tens of thousands of emails. Loosening the bucket floors alone
// moved every headline (the best reply workflow went from 11 replies over 13,985 emails to 2 over
// 3,936, and its price with it), which is why these are their own constants rather than the same
// three. A price we put in a title is a claim; a price beside a bar is a reading.
const BEST_WORKFLOW_MIN_EMAILS = 1000;
const BEST_WORKFLOW_MIN_CLICKS = 20;
const BEST_WORKFLOW_MIN_REPLIES = 10;

// ---------- csv ----------
// Streaming, because generations.csv is ~80MB and holds every email we wrote.
// Rows are handed to the caller one at a time so nothing keeps the raw text alive.
function eachRow(file, onRow) {
  const fd = openSync(join(dir, file), "r");
  const buf = Buffer.alloc(1 << 20);
  let rest = "";
  let head = null;
  let row = [], field = "", quoted = false, pendingQuote = false;
  const flushRow = () => {
    row.push(field); field = "";
    if (!head) head = row;
    else if (row.length === head.length) {
      const o = {};
      for (let k = 0; k < head.length; k++) o[head[k]] = row[k];
      onRow(o);
    }
    row = [];
  };
  const feed = (text) => {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') { field += '"'; continue; }
        quoted = false;
      }
      if (quoted) {
        if (ch === '"') { pendingQuote = true; continue; }
        field += ch; continue;
      }
      if (ch === '"') { quoted = true; continue; }
      if (ch === ",") { row.push(field); field = ""; continue; }
      if (ch === "\n") { flushRow(); continue; }
      if (ch === "\r") continue;
      field += ch;
    }
  };
  for (;;) {
    const n = readSync(fd, buf, 0, buf.length, null);
    if (n <= 0) break;
    rest += buf.toString("utf8", 0, n);
    feed(rest);
    rest = "";
  }
  closeSync(fd);
  if (field.length || row.length) flushRow();
}
function load(file) { const out = []; eachRow(file, (r) => out.push(r)); return out; }

// ---------- tiers ----------
const FRONTIER = new Set(["claude-fable-5-1", "gpt-6-astra"]);
function tierOf(model) {
  if (!model) return null;
  if (FRONTIER.has(model)) return "Frontier";
  return /flash|lite|haiku/.test(model) ? "Flash" : "Pro";
}

// ---------- link / shape of the generated text ----------
const TLD = "(?:com|io|ai|co|net|org|app|dev|so|me|us|uk|xyz|health|care|clinic|agency|studio|tech|biz|info|fr|de|ca)";
const BARE = new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.${TLD}\\b(?:/[^\\s<"']*)?`, "i");
const EMPTY_SHAPE = { chars: 0, paragraphs: 1, hasLink: false, subjectChars: 0 };
function shapeOf(body) {
  const html = body || "";
  const paragraphs = /<p[\s>]/i.test(html)
    ? (html.match(/<p[\s>]/gi) || []).length
    : (html.split(/\n\s*\n|\n/).filter((l) => l.trim().length).length || 1);
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  const withoutEmails = text.replace(/\S+@\S+/g, " ");
  const hasLink = /https?:\/\//i.test(withoutEmails) || BARE.test(withoutEmails);
  return { chars: text.length, paragraphs, hasLink };
}

// ---------- load ----------
const emails = load("emails.csv");
const clicks = load("clicks.csv");
const replies = load("positive-replies.csv");
const genByKey = new Map();       // person -> { model, workflow }
const genShapeByKey = new Map();  // person|step -> shape
eachRow("generations.csv", (g) => {
  if (!g.lead_id) return;
  const person = `${g.platform_campaign_id}|${g.lead_id}`;
  if (!genByKey.has(person)) genByKey.set(person, { model: g.model, workflow: g.workflow_slug, template: g.prompt_type || null });
  const sh = shapeOf(g.body_text);
  sh.subjectChars = (g.subject || "").length;
  genShapeByKey.set(`${person}|${g.step}`, sh);
});
const leads = load("leads.csv");
const spendRows = load("spend.csv");
// workflow version -> its dynasty (workflow-service); the Research page compares dynasties
const dynastyOf = new Map(load("workflows.csv").map((w) => [w.workflow_slug, w.workflow_dynasty_slug]));
function dynastyOfVersion(slug) {
  const d = dynastyOf.get(slug);
  if (!d) throw new Error(`workflow ${slug} is not in workflows.csv: re-run extract.sh`);
  return d;
}
const scannerRows = load("scanner-hits.csv");
// platform campaign -> the leg it performs; "" (a campaign from before legs existed) is no leg
const legOf = new Map(load("campaign-legs.csv").map((c) => [c.platform_campaign_id, c.leg_key || null]));
const spendLegRows = load("spend-legs.csv");
// The two legs the Research crews buy, one each.
const HERALD_LEG = "start_to_conversation";
const SCOUT_LEG = "start_to_website_visit";

const stepByKey = new Map();
eachRow("sequence-steps.csv", (r) => {
  const sh = shapeOf(r.body_html);
  sh.subjectChars = (r.subject || "").length;
  stepByKey.set(`${r.instantly_campaign_id}|${r.step}`, sh);
});
const leadById = new Map();
for (const l of leads) leadById.set(l.lead_id, l);
const clickByKey = new Map();
for (const c of clicks) clickByKey.set(`${c.instantly_campaign_id}|${c.lead_email}`, c);
const replyByKey = new Map();
// a reply after the window's end was not observed in it, the same bound extract.sh puts on clicks
for (const r of replies) {
  if (r.replied_at && toMs(r.replied_at) >= windowEndMs) continue;
  replyByKey.set(`${r.instantly_campaign_id}|${r.lead_email}`, r);
}
const spendByWorkflow = new Map();
for (const s of spendRows) spendByWorkflow.set(s.workflow_slug, Number(s.cents) / 100);

// ---------- fact table: one row per email ----------
const perWorkflowEmails = new Map();
for (const e of emails) perWorkflowEmails.set(e.workflow_slug, (perWorkflowEmails.get(e.workflow_slug) || 0) + 1);
const costPerEmail = new Map();
for (const [wf, n] of perWorkflowEmails) {
  const spend = spendByWorkflow.get(wf);
  if (spend === undefined || !n) continue;
  costPerEmail.set(wf, spend / n);
}

const CONTINENT = {
  "united states": "North America", canada: "North America", mexico: "North America",
  france: "Europe", germany: "Europe", "united kingdom": "Europe", spain: "Europe", italy: "Europe",
  netherlands: "Europe", belgium: "Europe", switzerland: "Europe", ireland: "Europe", portugal: "Europe",
  sweden: "Europe", norway: "Europe", denmark: "Europe", finland: "Europe", poland: "Europe",
  austria: "Europe", romania: "Europe", "czech republic": "Europe", greece: "Europe", hungary: "Europe",
  india: "Asia", singapore: "Asia", japan: "Asia", china: "Asia", israel: "Asia", "hong kong": "Asia",
  "united arab emirates": "Asia", philippines: "Asia", indonesia: "Asia", malaysia: "Asia",
  "south korea": "Asia", thailand: "Asia", vietnam: "Asia", pakistan: "Asia", turkey: "Asia",
  australia: "Oceania", "new zealand": "Oceania",
  brazil: "South America", argentina: "South America", chile: "South America", colombia: "South America",
  "south africa": "Africa", nigeria: "Africa", kenya: "Africa", egypt: "Africa", morocco: "Africa",
};

function sizeBucket(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v <= 10) return "1-10";
  if (v <= 50) return "11-50";
  if (v <= 200) return "51-200";
  if (v <= 1000) return "201-1000";
  return "1000+";
}
function lengthBucket(chars) {
  if (chars < 400) return "under 400";
  if (chars < 500) return "400 to 500";
  if (chars < 650) return "500 to 650";
  if (chars < 800) return "650 to 800";
  return "over 800";
}
function paragraphBucket(p) {
  if (p <= 1) return "1";
  if (p <= 3) return "2 to 3";
  if (p <= 5) return "4 to 5";
  return "6 or more";
}
function subjectBucket(n) {
  if (n <= 20) return "20 or fewer";
  if (n <= 30) return "21 to 30";
  if (n <= 40) return "31 to 40";
  return "over 40";
}
function hourBucket(h) {
  if (h <= 5) return "0-5";
  if (h <= 8) return "6-8";
  if (h <= 11) return "9-11";
  if (h <= 13) return "12-13";
  if (h <= 16) return "14-16";
  if (h <= 19) return "17-19";
  return "20-23";
}
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localHour(sentAt, tz) {
  if (!tz) return null;
  try {
    const d = new Date(`${sentAt.replace(" ", "T")}Z`);
    const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(d);
    const n = Number(h);
    return Number.isFinite(n) ? n % 24 : null;
  } catch { return null; }
}

const facts = [];
// One row per email whose campaign states a leg, for the research block. It carries no cost yet:
// the research prices each (workflow version, leg) on its own spend, once the maturation cutoff
// is known.
const researchRows = [];
let researchNoDynasty = 0;
for (const e of emails) {
  const cpe = costPerEmail.get(e.workflow_slug);
  const leg = legOf.get(e.platform_campaign_id) ?? null;
  if (cpe === undefined && !leg) continue; // a workflow with no tracked spend cannot be priced
  const person = e.lead_id ? `${e.platform_campaign_id}|${e.lead_id}` : null;
  const gen = person ? genByKey.get(person) : null;
  const stepNo = Number(e.step) || 1;
  const shape = (person && genShapeByKey.get(`${person}|${stepNo}`)) || stepByKey.get(`${e.instantly_campaign_id}|${e.step}`) || EMPTY_SHAPE;
  const firstShape = (person && genShapeByKey.get(`${person}|1`)) || stepByKey.get(`${e.instantly_campaign_id}|1`) || null;
  const lead = e.lead_id ? leadById.get(e.lead_id) : null;
  const click = clickByKey.get(`${e.instantly_campaign_id}|${e.lead_email}`);
  const reply = replyByKey.get(`${e.instantly_campaign_id}|${e.lead_email}`);
  const country = (lead?.country || "").trim();
  const sentAt = e.sent_at;
  const d = new Date(`${sentAt.replace(" ", "T")}Z`);
  const model = gen?.model || null;
  const row = {
    workflow: e.workflow_slug,
    dynasty: cpe !== undefined ? dynastyOfVersion(e.workflow_slug) : dynastyOf.get(e.workflow_slug) ?? null,
    leg,
    orgId: e.org_id,
    person: `${e.instantly_campaign_id}|${e.lead_email}`,
    leadEmail: e.lead_email,
    stepNo: Number(e.step),
    transport: e.send_transport,
    hasLink: shape.hasLink,
    chars: shape.chars,
    paragraphs: shape.paragraphs,
    subjectChars: shape.subjectChars || 0,
    firstChars: firstShape ? firstShape.chars : null,
    firstParagraphs: firstShape ? firstShape.paragraphs : null,
    model,
    // the prompt template that wrote the sequence (content-generation's prompt_type)
    template: gen?.template || null,
    tier: tierOf(model),
    country: country || null,
    continent: country ? CONTINENT[country.toLowerCase()] || "Other" : null,
    seniority: lead?.seniority || null,
    size: sizeBucket(lead?.estimated_num_employees),
    industry: (lead?.industry || "").trim() || null,
    localHour: localHour(sentAt, e.timezone || lead?.timezone),
    weekday: WEEKDAY[d.getUTCDay()],
    month: sentAt.slice(0, 7),
    // an outcome lands on exactly one email: the one the provider named for a click,
    // the last email at or before the inbound message for a reply
    clicked: click ? Number(click.step) === Number(e.step) : false,
    // which tracking recorded the visit: our own /c/ redirect, or the sending provider's.
    // Only the self-send hits pass through the link-scanner classification.
    clickSource: click ? click.source : null,
    _clickAt: click && Number(click.step) === Number(e.step) ? click.clicked_at : null,
    replied: false,
    _replyAt: reply?.replied_at || null,
    _sentAt: sentAt,
  };
  if (cpe !== undefined) facts.push({ ...row, cost: cpe });
  if (leg) {
    if (row.dynasty) researchRows.push({ ...row, platformCampaign: e.platform_campaign_id });
    else researchNoDynasty++;
  }
}

// attribute each positive reply to the last email sent at or before it
function attributeReplies(rows) {
  const byPerson = new Map();
  for (const f of rows) {
    if (!f._replyAt) continue;
    if (f._sentAt > f._replyAt) continue;
    const cur = byPerson.get(f.person);
    if (!cur || f._sentAt > cur._sentAt) byPerson.set(f.person, f);
  }
  for (const f of byPerson.values()) f.replied = true;
}
attributeReplies(facts);
attributeReplies(researchRows);

// ---------- maturation ----------
// Measured from the outcomes themselves: how long after the email that earned it a click or a
// positive reply arrives. Every figure below is computed on the MATURE emails only, those sent
// early enough for 95 in 100 of their outcomes to have landed before the window's end.
const maturation = (() => {
  const samples = { reply: [], click: [] };
  for (const f of facts) {
    const sentMs = toMs(f._sentAt);
    if (f.replied) samples.reply.push({ sentMs, outcomeMs: toMs(f._replyAt) });
    if (f._clickAt) samples.click.push({ sentMs, outcomeMs: toMs(f._clickAt) });
  }
  const m = measureMaturation(samples, windowEndMs);
  const cutoff = maturationCutoff(WINDOW.to, m.days);
  return { ...m, windowEnd: WINDOW.to, cutoff, note: maturationNote(m, cutoff) };
})();
const allFacts = facts.length;
// Every email SENT in the window stays countable as a total, and the pages label it as such;
// only the prices and the rates are computed on the mature ones.
const sentVolume = {
  emails: facts.length,
  people: new Set(facts.map((f) => f.leadEmail)).size,
  orgs: new Set(facts.map((f) => f.orgId)).size,
};
for (let i = facts.length - 1; i >= 0; i--) if (!isMature(facts[i]._sentAt, maturation.cutoff)) facts.splice(i, 1);
maturation.excludedEmails = allFacts - facts.length;
for (const f of facts) { delete f._replyAt; delete f._sentAt; delete f._clickAt; }

// ---------- bucketing ----------
const round = (n, d = 0) => Number(n.toFixed(d));
function agg(rows) {
  let emails = 0, spend = 0, clicks = 0, replies = 0;
  for (const r of rows) { emails++; spend += r.cost; if (r.clicked) clicks++; if (r.replied) replies++; }
  return {
    emails,
    spend: round(spend, 2),
    clicks,
    replies,
    clicksPerThousand: emails ? round((clicks / emails) * 1000, 1) : 0,
    repliesPerTenThousand: emails ? round((replies / emails) * 10000, 1) : 0,
    // every bucket with an outcome gets a price and a bar; `thin` says a reader should
    // weigh it against the counts printed beside it rather than take it as a rate
    cpc: clicks ? round(spend / clicks, 2) : null,
    cpcThin: !clicks || emails < MIN_EMAILS || clicks < MIN_CLICKS,
    cpr: replies ? round(spend / replies, 2) : null,
    cprThin: !replies || emails < MIN_EMAILS || replies < MIN_REPLIES,
  };
}
// An `order` makes the cut ORDINAL: its buckets are a sequence, a length band, an hour of the
// day, and reading them in any other order says something false about the thing measured. Every
// row carries that fact (`ordinal`) so the renderer draws the cut in this order rather than
// ranking it. A cut with no `order` is CATEGORICAL (a role, an industry, a country): its keys
// only sort alphabetically here so the derivation is deterministic, and the renderer ranks it
// by the value it is drawing.
function cut(rows, keyFn, order) {
  const by = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === null || k === undefined || k === "") continue;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  let keys = [...by.keys()];
  if (order) keys = order.filter((k) => by.has(k)).concat(keys.filter((k) => !order.includes(k)).sort());
  else keys.sort();
  return keys.map((k) => ({ bucket: String(k), ordinal: Boolean(order), ...agg(by.get(k)) }));
}

const linked = facts.filter((f) => f.hasLink);
const firstEmails = facts.filter((f) => f.stepNo === 1);
const linkedFirst = linked.filter((f) => f.stepNo === 1);
// step 0 is the backfill source that did not report which email of the sequence it was;
// those emails stay in every total and are named by no step bucket
const stepLabel = (f) =>
  f.stepNo === 1 ? "First email" : f.stepNo >= 2 ? `Follow-up ${f.stepNo - 1}` : null;

const LEN = ["under 400", "400 to 500", "500 to 650", "650 to 800", "over 800"];
const PARA = ["1", "2 to 3", "4 to 5", "6 or more"];
const SUBJ = ["20 or fewer", "21 to 30", "31 to 40", "over 40"];
const SIZE = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const HOUR = ["0-5", "6-8", "9-11", "12-13", "14-16", "17-19", "20-23"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STEPS = ["First email", "Follow-up 1", "Follow-up 2", "Follow-up 3"];

const topN = (rows, n, keyFn) => {
  const by = new Map();
  for (const r of rows) { const k = keyFn(r); if (!k) continue; by.set(k, (by.get(k) || 0) + 1); }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
};

function cutsFor(rows, label) {
  const topCountries = topN(rows, 6, (r) => r.country);
  const topIndustries = topN(rows, 7, (r) => r.industry);
  return {
    label,
    total: agg(rows),
    byModel: cut(rows, (r) => (r.model ? MODEL_LABEL[r.model] || r.model : null)),
    byTier: cut(rows, (r) => r.tier, ["Flash", "Pro", "Frontier"]),
    byStep: cut(rows, stepLabel, STEPS),
    byFirstLength: cut(rows.filter((r) => r.stepNo === 1), (r) => lengthBucket(r.chars), LEN),
    byParagraphs: cut(rows.filter((r) => r.stepNo === 1), (r) => paragraphBucket(r.paragraphs), PARA),
    bySubject: cut(rows.filter((r) => r.stepNo === 1 && r.subjectChars > 0), (r) => subjectBucket(r.subjectChars), SUBJ),
    byContinent: cut(rows, (r) => r.continent),
    byCountry: cut(rows.filter((r) => topCountries.includes(r.country)), (r) => r.country),
    bySeniority: cut(rows, (r) => r.seniority),
    bySize: cut(rows, (r) => r.size, SIZE),
    byIndustry: cut(rows.filter((r) => topIndustries.includes(r.industry)), (r) => r.industry),
    byHour: cut(rows, (r) => (r.localHour === null ? null : hourBucket(r.localHour)), HOUR),
    byWeekday: cut(rows, (r) => r.weekday, DAYS),
    // a month is a sequence like every other ordinal cut; the keys happen to sort chronologically
    // (`2026-04`), and passing them as the order is what says so rather than leaving it to luck
    byMonth: cut(rows, (r) => r.month, [...new Set(rows.map((r) => r.month))].filter(Boolean).sort()),
    byLink: cut(rows, (r) => (r.hasLink ? "link in the body" : "no link"), ["link in the body", "no link"]),
  };
}

// best workflow per outcome, reported by its tier and model, never by its codename
function bestWorkflows(rows, minEmails = BEST_WORKFLOW_MIN_EMAILS) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.workflow)) by.set(r.workflow, []);
    by.get(r.workflow).push(r);
  }
  const out = [];
  for (const [wf, rs] of by) {
    if (rs.length < minEmails) continue;
    const a = agg(rs);
    const models = topN(rs, 1, (r) => (r.model ? MODEL_LABEL[r.model] || r.model : null));
    const tiers = topN(rs, 1, (r) => r.tier);
    const linkedRows = rs.filter((r) => r.hasLink);
    const la = agg(linkedRows);
    out.push({
      workflow: wf, tier: tiers[0] || null, model: models[0] || null,
      emails: a.emails, spend: a.spend, clicks: a.clicks, replies: a.replies,
      clicksPerThousand: a.clicksPerThousand, repliesPerTenThousand: a.repliesPerTenThousand,
      cpr: a.replies ? round(a.spend / a.replies, 2) : null,
      cprThin: !a.replies || a.emails < BEST_WORKFLOW_MIN_EMAILS || a.replies < BEST_WORKFLOW_MIN_REPLIES,
      linkedEmails: la.emails, linkedSpend: la.spend, linkedClicks: la.clicks,
      // the click rate on the emails that carried a link, which is the only honest
      // denominator for a workflow's cost per visit
      linkedClicksPerThousand: la.clicksPerThousand,
      cpc: la.clicks ? round(la.spend / la.clicks, 2) : null,
      cpcThin: !la.clicks || la.emails < BEST_WORKFLOW_MIN_EMAILS || la.clicks < BEST_WORKFLOW_MIN_CLICKS,
    });
  }
  return out.sort((a, b) => b.emails - a.emails);
}

const people = new Set(facts.map((f) => f.leadEmail)).size;
const orgs = new Set(facts.map((f) => f.orgId)).size;
const linkedPeople = new Set(linked.map((f) => f.leadEmail)).size;
const clickPeople = new Set(facts.filter((f) => f.clicked).map((f) => f.leadEmail)).size;

const out = {
  generatedAt: new Date().toISOString(),
  window: WINDOW,
  maturation,
  floors: { minEmails: MIN_EMAILS, minClicks: MIN_CLICKS, minReplies: MIN_REPLIES,
    bestWorkflow: { minEmails: BEST_WORKFLOW_MIN_EMAILS, minClicks: BEST_WORKFLOW_MIN_CLICKS, minReplies: BEST_WORKFLOW_MIN_REPLIES } },
  volume: {
    sent: sentVolume,
    emails: facts.length,
    people,
    orgs,
    workflows: new Set(facts.map((f) => f.workflow)).size,
    spend: round(facts.reduce((s, f) => s + f.cost, 0), 2),
    clicks: facts.filter((f) => f.clicked).length,
    // The scanner correction reaches the self-send clicks only; the provider's own tracking
    // is its own, and the articles say so rather than letting a reader assume otherwise.
    clicksBySource: (() => {
      const clicked = facts.filter((f) => f.clicked);
      const selfSend = clicked.filter((f) => f.clickSource === "self_send").length;
      return { selfSend, provider: clicked.length - selfSend };
    })(),
    clickPeople,
    replies: facts.filter((f) => f.replied).length,
    linked: {
      emails: linked.length,
      people: linkedPeople,
      spend: round(linked.reduce((s, f) => s + f.cost, 0), 2),
      clicks: linked.filter((f) => f.clicked).length,
    },
    droppedForNoSpend: emails.length - facts.length,
    firstEmails: firstEmails.length,
  },
  // The link-scanner verdict on our own /c/ hits, so the article states what the correction
  // actually demoted rather than a figure typed once. A hit still awaiting its verdict is
  // neither promoted nor demoted, so the page divides by the DECIDED ones.
  scanner: (() => {
    const r = scannerRows[0];
    if (!r) throw new Error("scanner-hits.csv is empty: re-run extract.sh");
    const human = Number(r.human);
    const demoted = Number(r.demoted);
    const undecided = Number(r.undecided);
    if (!Number.isFinite(human) || !Number.isFinite(demoted) || !Number.isFinite(undecided)) {
      throw new Error(`scanner-hits.csv is not numeric: ${JSON.stringify(r)}`);
    }
    return { decided: human + demoted, human, demoted, undecided, hits: Number(r.hits) };
  })(),
  all: cutsFor(facts, "every email"),
  linked: cutsFor(linked, "emails with a link in the body"),
  flash: cutsFor(facts.filter((f) => f.tier === "Flash"), "Flash tier"),
  pro: cutsFor(facts.filter((f) => f.tier === "Pro"), "Pro tier"),
  flashLinked: cutsFor(linked.filter((f) => f.tier === "Flash"), "Flash tier, emails with a link"),
  proLinked: cutsFor(linked.filter((f) => f.tier === "Pro"), "Pro tier, emails with a link"),
  workflows: bestWorkflows(facts),
};

// The best workflow per outcome, which is the one a client is served. Reported by its
// tier and its model, never by its codename: nobody outside the team knows the names.
// cheapest first; on a tie the one with more clicks behind it, so the pick is stable
const priced = out.workflows.filter((w) => w.cpc !== null && !w.cpcThin).sort((a, b) => a.cpc - b.cpc || b.linkedClicks - a.linkedClicks);
const replied = out.workflows.filter((w) => w.cpr !== null && !w.cprThin).sort((a, b) => a.cpr - b.cpr || b.replies - a.replies);
out.best = {
  visit: priced[0] ? { ...priced[0], workflow: undefined } : null,
  visitRunnerUp: priced[1] ? { ...priced[1], workflow: undefined } : null,
  bestPricedPro: priced.find((w) => w.tier === "Pro") ? { ...priced.find((w) => w.tier === "Pro"), workflow: undefined } : null,
  reply: replied[0] ? { ...replied[0], workflow: undefined } : null,
  pricedCount: priced.length,
  // how much of the Pro tier's reply volume the follow-ups carry, which is what the
  // published studies report a share for
  followUpReplyShare: (() => {
    const pro = facts.filter((f) => f.tier === "Pro" && f.replied);
    return pro.length ? Math.round((pro.filter((f) => f.stepNo >= 2).length / pro.length) * 100) : null;
  })(),
  workflowsPastFloor: out.workflows.length,
};

// ---------- research ----------
// The staff Research page (dashboard v2) reads these beside the article cuts: the same fact
// table, so a study and an article can never state two figures for one population. Every
// month series is per model and per template, so the page can draw how the WINNER moved.
const modelLabel = (r) => (r.model ? MODEL_LABEL[r.model] || r.model : null);
const monthsOf = (rows) => [...new Set(rows.map((r) => r.month))].filter(Boolean).sort();
function byMonthPer(rows, keyFn) {
  const groups = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const outMap = {};
  for (const [k, rs] of groups) outMap[k] = cut(rs, (r) => r.month, monthsOf(rs));
  return outMap;
}
function researchFor(rows) {
  return {
    byModel: cut(rows, modelLabel),
    byTemplate: cut(rows, (r) => r.template),
    byStep: cut(rows, stepLabel, STEPS),
    byMonth: cut(rows, (r) => r.month, monthsOf(rows)),
    modelByMonth: byMonthPer(rows, modelLabel),
    templateByMonth: byMonthPer(rows, (r) => r.template),
    // A workflow here is a DYNASTY (every version of one lineage, pooled), keyed by its slug
    // HERE only (facts.json is never committed); research.mjs names it by what it runs, the model
    // and the template, and never prints the slug.
    byWorkflow: cut(rows, (r) => r.dynasty),
    workflowByMonth: byMonthPer(rows, (r) => r.dynasty),
  };
}
// What each dynasty runs: the model and the template that wrote most of its emails.
function workflowMeta(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.dynasty)) by.set(r.dynasty, []);
    by.get(r.dynasty).push(r);
  }
  const meta = {};
  for (const [wf, rs] of by) meta[wf] = { model: topN(rs, 1, modelLabel)[0] || null, template: topN(rs, 1, (r) => r.template)[0] || null };
  return meta;
}
// The research population: mature emails of ONE leg each, priced on their own leg's spend.
// Cost per email = what a (workflow version, leg) was charged before the maturation cutoff,
// over the mature emails it sent in the same window, so the numerator and the denominator
// cover the same days and the same population the figures use.
const research = (() => {
  const all = researchRows.length;
  const mature = researchRows.filter((r) => isMature(r._sentAt, maturation.cutoff));
  const spendByVersionLeg = new Map();
  let spendNoLeg = 0;
  for (const s of spendLegRows) {
    if (s.day >= maturation.cutoff) continue;
    const leg = legOf.get(s.platform_campaign_id) ?? null;
    const cents = Number(s.cents);
    if (!leg) { spendNoLeg += cents; continue; }
    const k = `${s.workflow_slug}|${leg}`;
    spendByVersionLeg.set(k, (spendByVersionLeg.get(k) || 0) + cents / 100);
  }
  const emailsByVersionLeg = new Map();
  for (const r of mature) {
    const k = `${r.workflow}|${r.leg}`;
    emailsByVersionLeg.set(k, (emailsByVersionLeg.get(k) || 0) + 1);
  }
  const priced = [];
  let noSpend = 0;
  for (const r of mature) {
    const k = `${r.workflow}|${r.leg}`;
    const spend = spendByVersionLeg.get(k);
    if (spend === undefined) { noSpend++; continue; }
    r.cost = spend / emailsByVersionLeg.get(k);
    delete r._replyAt; delete r._sentAt; delete r._clickAt;
    priced.push(r);
  }
  const herald = priced.filter((r) => r.leg === HERALD_LEG);
  const scoutAll = priced.filter((r) => r.leg === SCOUT_LEG);
  const scout = scoutAll.filter((r) => r.hasLink);
  const union = [...herald, ...scoutAll];
  // what the leg scope moved out of each crew, measured on the article's (fleet-wide) population
  const scope = {
    herald: {
      before: facts.length,
      otherLeg: facts.filter((f) => f.leg && f.leg !== HERALD_LEG).length,
      noLeg: facts.filter((f) => !f.leg).length,
      after: herald.length,
    },
    scout: {
      before: linked.length,
      otherLeg: linked.filter((f) => f.leg && f.leg !== SCOUT_LEG).length,
      noLeg: linked.filter((f) => !f.leg).length,
      after: scout.length,
    },
    immature: all - mature.length,
    droppedForNoSpend: noSpend,
    droppedForNoDynasty: researchNoDynasty,
    spendOnNoLeg: round(spendNoLeg / 100, 2),
  };
  return { herald, scout, union, scope, immature: all - mature.length };
})();
const minMonth = (rows) => rows.reduce((m, f) => (!m || f.month < m ? f.month : m), null);
const maxMonth = (rows) => rows.reduce((m, f) => (!m || f.month > m ? f.month : m), null);
out.research = {
  window: { from: minMonth(research.union), to: maxMonth(research.union) },
  // Herald buys a positive reply on the start_to_conversation leg; Scout a website visit on the
  // start_to_website_visit leg, priced on the emails that carried a link.
  reply: researchFor(research.herald),
  visit: researchFor(research.scout),
  // what each workflow runs, per crew: a dynasty can run a different model on each leg
  workflowMeta: { reply: workflowMeta(research.herald), visit: workflowMeta(research.scout) },
  volume: {
    emails: research.union.length,
    orgs: new Set(research.union.map((f) => f.orgId)).size,
    workflows: new Set(research.union.map((f) => f.workflow)).size,
    linkedEmails: research.scout.length,
    byMonth: cut(research.union, (r) => r.month, monthsOf(research.union)).map((r) => ({ bucket: r.bucket, emails: r.emails })),
  },
  excludedEmails: research.immature,
  scope: research.scope,
};

process.stdout.write(JSON.stringify(out, null, 2));
