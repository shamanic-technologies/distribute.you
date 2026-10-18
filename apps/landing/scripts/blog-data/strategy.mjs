// Which LEAD STRATEGY served each Research email, and which strategy SOURCED its lead.
//
// campaign-service records, at dispatch, the play every run was served under
// (`run_play_attributions`, append-only, one row per run, since 2026-10-18): the strategy, and
// whether that play is the pipe's default. extract.sh dumps it beside two joins its producer
// verified:
//   - the cold email a lead got: its generation's run_id IS the attributed execute-workflow run;
//   - the strategy that FOUND the lead: the sourcing row lead-service keeps for it
//     (leads_campaigns, parent_run_id = the sourcing run) handed to the outreach campaign, or an
//     on_demand sourcing run whose caller_run_id is the outreach run that asked for the lead.
// An email whose run carries no attribution (everything sent before 2026-10-18) is OUT of the
// strategy studies, never filed under the default strategy: nobody recorded what served it.
// Pure functions: derive.mjs feeds the dumps, tests/unit/research-strategy.test.ts the fixtures.

const RESOLVED = "resolved";

/**
 * attributions: run_play_attributions rows (run_id, run_kind, caller_run_id, play_state,
 *   strategy_id, play_is_default, recorded_at); handoffs: lead-service sourcing rows (lead_id,
 *   platform_campaign_id = the outreach campaign the lead was handed to, source_run_id);
 *   strategies: features-service's catalogue ({ id, name }).
 */
export function attributionIndex({ attributions, handoffs, strategies }) {
  const byRun = new Map();
  const onDemandByCaller = new Map();
  let firstRecordedAt = null;
  for (const a of attributions) {
    byRun.set(a.run_id, a);
    if (a.run_kind === "on_demand" && a.caller_run_id) {
      if (!onDemandByCaller.has(a.caller_run_id)) onDemandByCaller.set(a.caller_run_id, []);
      onDemandByCaller.get(a.caller_run_id).push(a);
    }
    if (a.recorded_at && (!firstRecordedAt || a.recorded_at < firstRecordedAt)) firstRecordedAt = a.recorded_at;
  }
  const handedRuns = new Map();
  for (const h of handoffs) {
    const k = `${h.lead_id}|${h.platform_campaign_id}`;
    if (!handedRuns.has(k)) handedRuns.set(k, new Set());
    handedRuns.get(k).add(h.source_run_id);
  }
  const nameOf = new Map(strategies.map((s) => [s.id, s.name]));
  const isDefault = (a) => a.play_is_default === "true" || a.play_is_default === true || a.play_is_default === "t";
  const resolved = (a) => (a && a.play_state === RESOLVED && a.strategy_id ? { id: a.strategy_id, isDefault: isDefault(a) } : null);

  return {
    firstRecordedAt,
    nameOf,
    /** The strategy the run that wrote this email was served under: { state, id, isDefault }. */
    strategyOf(runId) {
      const a = runId ? byRun.get(runId) : null;
      if (!a) return { state: "unattributed", id: null, isDefault: false };
      const r = resolved(a);
      return r ? { state: RESOLVED, ...r } : { state: a.play_state || "unreadable", id: null, isDefault: false };
    },
    /**
     * Every strategy that sourced this lead for this outreach campaign. A lead several sourcing
     * runs found carries EVERY strategy (multi-signal provenance), each one once.
     */
    sourcesOf(runId, leadId, campaignId) {
      const found = new Map();
      const take = (a) => { const r = resolved(a); if (r && !found.has(r.id)) found.set(r.id, r); };
      for (const a of (runId && onDemandByCaller.get(runId)) || []) take(a);
      for (const sr of handedRuns.get(`${leadId}|${campaignId}`) || []) take(byRun.get(sr));
      return [...found.values()];
    },
  };
}

/**
 * A bar's label: the strategy's served name, marked "(default)" when the play that served these
 * emails is the pipe's default one. A strategy no catalogue row names is a broken read: it throws.
 */
export function strategyLabels(rows, idOf, defaultOf, nameOf) {
  const labels = {};
  const defaults = new Set();
  for (const r of rows) {
    const id = idOf(r);
    if (!id) continue;
    if (defaultOf(r)) defaults.add(id);
    labels[id] = null;
  }
  for (const id of Object.keys(labels)) {
    const name = nameOf.get(id);
    if (!name) throw new Error(`strategy ${id} is not in strategies.json: re-run extract.sh`);
    labels[id] = defaults.has(id) ? `${name} (default)` : name;
  }
  return labels;
}

/** One row per (email, sourcing strategy): a lead found by two strategies counts in both bars. */
export function bySourceStrategy(rows) {
  const out = [];
  for (const r of rows) for (const s of r.sourceStrategies || []) out.push({ ...r, sourceStrategy: s.id, sourceDefault: s.isDefault });
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayText = (ymd) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}, ${ymd.slice(0, 4)}`;
const num = (v) => Number(v).toLocaleString("en-US");
const emailsText = (v, o) => `${num(v)} ${v === 1 ? o.emailsNoun.replace(/^emails/, "email") : o.emailsNoun}`;

/**
 * The population line of a strategy study: who is in, who is out and why. scope is derive.mjs's
 * research.strategy[pipe].scope, kind "strategy" (the play that served the email) or "sourcing"
 * (the play that found the lead), o the pipe's outcome words, ruleDays the maturity rule's days.
 */
export function strategyPopulation(scope, o, kind, ruleDays) {

  const inside = kind === "sourcing"
    ? `Population: the ${emailsText(scope.sourced, o)} whose lead a recorded sourcing strategy found (a lead two strategies found counts under each), out of ${emailsText(scope.emails, o)} on this pipe.`
    : `Population: the ${emailsText(scope.attributed, o)} a lead strategy is recorded for, out of ${emailsText(scope.emails, o)} on this pipe.`;
  const noPlay = scope.noPlay ? `, and so are the ${emailsText(scope.noPlay, o)} whose run was served under no strategy` : "";
  const out = scope.recordedFrom
    ? `A run's strategy is recorded since ${dayText(scope.recordedFrom)}: the ${emailsText(scope.unattributed, o)} that ${scope.unattributed === 1 ? "carries" : "carry"} no record (every email before that day) ${scope.unattributed === 1 ? "is" : "are"} left out, never counted under the default${noPlay}.`
    : `No run's strategy was recorded yet: the ${emailsText(scope.unattributed, o)} that ${scope.unattributed === 1 ? "carries" : "carry"} no record ${scope.unattributed === 1 ? "is" : "are"} left out, never counted under the default${noPlay}.`;
  const waiting = scope.waiting ? ` ${emailsText(scope.waiting, o)} already ${scope.waiting === 1 ? "carries one and waits" : "carry one and wait"} for the ${ruleDays}-day rule.` : "";
  const roi = kind === "sourcing" ? ` Rate only: finding the lead is paid on the sourcing run, outside the cold email spend, so a cost per ${o.noun} here would leave it out.` : "";
  return `${inside} ${out}${waiting}${roi}`;
}
