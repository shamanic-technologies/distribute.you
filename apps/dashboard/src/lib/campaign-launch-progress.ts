import type { Lead, RunEvent } from "@/lib/api";

/**
 * Drives the non-closable launch modal shown right after a campaign is created.
 * The first email takes minutes to arrive (lead-finding → email-gen → sending);
 * a silent screen reads as "nothing happened". The modal blocks the dashboard
 * and walks the user through four reassurance steps, each advancing on a REAL
 * backend signal (not a timer), then closes the moment the first email is sent.
 *
 * Source of truth = run_events (campaignId-scoped, polled by the overview) for
 * the per-service "-start" signals, plus the campaign leads for the terminal
 * "a lead got contacted" close condition. Pure functions only — the React state
 * (poll, latch, session-dismiss) lives in the component; this module is the
 * testable mapping from wire data → step index.
 */

export interface LaunchStep {
  /** Stable key for React + tests. */
  key: string;
  /** Copy shown in the modal (matches the approved design). Step 0 substitutes
   *  the brand domain at render — see the component. */
  label: string;
}

/**
 * The four steps, in order. Index 0 ("reading") is the default — active on
 * arrival, no signal needed. Indices 1-3 each unlock on a backend run-start
 * event (see STEP_SIGNALS). The index into this array IS how far the launch has
 * progressed, so the component renders done/current/pending off a single number.
 */
export const LAUNCH_STEPS: readonly LaunchStep[] = [
  { key: "reading", label: "Reading your website" },
  { key: "leads", label: "Finding leads matching your ICP" },
  { key: "writing", label: "Writing first batch of emails" },
  { key: "sending", label: "Setting up sending infrastructure" },
] as const;

/**
 * (service, event) that marks a step as reached. Verified against the
 * campaign-activity allowlist + runs-service events:
 *  - lead-service `buffer-next-start`            → step 1 (finding leads)
 *  - content-generation-service `generate-start` → step 2 (writing emails)
 *  - instantly-service `send-start`              → step 3 (sending infra)
 * The service is checked too (not just the slug) to guard a future collision,
 * mirroring `toActivityLabel`.
 */
const STEP_SIGNALS: ReadonlyArray<{ service: string; event: string }> = [
  { service: "lead-service", event: "buffer-next-start" },
  { service: "content-generation-service", event: "generate-start" },
  { service: "instantly-service", event: "send-start" },
];

/**
 * Highest step index *reached* given the current event window. Step 0 is always
 * reached. Runs are sequential (sending can't start before generation before
 * lead-buffering), so a later signal implies the earlier ones even when their
 * own event has scrolled out of the polled window — hence `max`, not a count.
 */
export function launchStepFromEvents(
  events: ReadonlyArray<Pick<RunEvent, "service" | "event">>,
): number {
  let reached = 0;
  for (const ev of events) {
    for (let i = 0; i < STEP_SIGNALS.length; i++) {
      const sig = STEP_SIGNALS[i];
      if (ev.service === sig.service && ev.event === sig.event) {
        reached = Math.max(reached, i + 1);
      }
    }
  }
  return reached;
}

/** True once at least one lead has been contacted — the modal's close condition. */
export function hasContactedLead(leads: ReadonlyArray<Pick<Lead, "contacted">>): boolean {
  return leads.some((l) => l.contacted === true);
}

/**
 * Bare hostname for the step-0 "Reading {domain}" label, or null when no usable
 * brand URL exists (the component falls back to a generic label). Accepts a bare
 * domain or a full URL; strips a leading `www.`. No try/catch — `URL.canParse`
 * filters malformed input before construction.
 */
export function domainFromUrls(urls: ReadonlyArray<string>): string | null {
  for (const raw of urls) {
    const candidate = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    if (!URL.canParse(candidate)) continue;
    const host = new URL(candidate).hostname.replace(/^www\./, "");
    if (host) return host;
  }
  return null;
}
