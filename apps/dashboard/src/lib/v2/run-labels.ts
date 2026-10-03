/**
 * How a run reads to a person: its label, its state, whether it did any work. Alias-free
 * (no `@/` import) so it is unit-tested for real (`tests/v2-run-labels.test.ts`).
 */

/** The served run fields these helpers read (a `RunRow` or a run's descendant step). */
export interface RunLike {
  serviceName: string;
  taskName: string;
  status: string;
  completedAt?: string | null;
  totalCostInUsdCents?: string;
}

/**
 * The run a crew starts for ONE lead (find, write, queue). Its children (judgments,
 * enrichment, the budget gate, the queued sends) are its steps, read on the run page.
 */
export const LEAD_RUN_TASK = "execute-workflow";

/**
 * A lead run that did something: still running, or it spent money. About two thirds of
 * lead runs stop at the budget gate with nothing to do and cost $0 (prod, 2026-10-03);
 * listing them buries the work. Reads two served fields, computes nothing.
 */
export function isWorkRun(run: RunLike): boolean {
  return runState(run) === "running" || Number(run.totalCostInUsdCents) > 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A run's step in words: the task runs-service recorded, made readable. Never a raw
 * slug or id: an unknown task reads "Ran a step".
 *
 * `email-send-step-N` is the moment the email was handed to the sending queue: all
 * steps of one lead are recorded within the same second, days before a follow-up goes
 * out. So it reads "Queued" / "Scheduled", never "Sent" (the real send is not a run).
 */
export function runTaskLabel(run: RunLike): string {
  const t = run.taskName;
  const send = /^email-send-step-(\d+)$/.exec(t);
  if (send) return send[1] === "1" ? "Queued the first email" : `Scheduled follow-up ${Number(send[1]) - 1}`;
  if (t === LEAD_RUN_TASK) return runState(run) === "running" ? "Working on a new lead" : "Prepared outreach to a new lead";
  // campaign-service files its budget gate under the campaign id as the task name.
  if (run.serviceName === "campaign-service" && UUID.test(t)) return "Checked the budget";
  if (t === "judgments") return "Checked a lead";
  if (t === "verify-email") return "Verified an email";
  if (/serve|buffer\/next|lead/i.test(t)) return "Found a lead";
  if (/generate|content/i.test(t) || run.serviceName === "content-generation-service") return "Wrote an email";
  if (/opportunit/i.test(t)) return "Looked for a press request";
  if (/complete|chat/i.test(t) || run.serviceName === "chat-service") return "Thought it through";
  if (/scrape|extract/i.test(t)) return "Read a website";
  if (/enrich|apollo|people-search|email-find|linkedin|signal/i.test(t) || run.serviceName === "apollo-service") return "Enriched a contact";
  return "Ran a step";
}

/** Consecutive steps with the same label, folded into one row with a count. */
export function foldSteps<T extends RunLike>(steps: T[]): { label: string; count: number; first: T; items: T[] }[] {
  const out: { label: string; count: number; first: T; items: T[] }[] = [];
  for (const s of steps) {
    const label = runTaskLabel(s);
    const last = out[out.length - 1];
    if (last && last.label === label) {
      last.count += 1;
      last.items.push(s);
    } else out.push({ label, count: 1, first: s, items: [s] });
  }
  return out;
}

export type RunState = "done" | "failed" | "running";

export function runState(run: RunLike): RunState {
  if (run.status === "failed" || run.status === "error") return "failed";
  if (run.completedAt || run.status === "completed") return "done";
  return "running";
}

