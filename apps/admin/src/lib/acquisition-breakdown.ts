/**
 * Signups by FIRST-TOUCH channel, off client-service's `org_acquisitions`.
 *
 * client-service records, once per org, the channel that first brought it (the
 * dashboard hands it over from a cookie on `.distribute.you`). This module turns
 * its `GET /internal/acquisitions` list into one row per channel with two counts
 * that must never be added together:
 *   - `signedUp`: orgs with a real account (`real: true`);
 *   - `started`: signed-out setups not claimed yet (`real: false`).
 *
 * "Not recorded" is its own row, never folded into `direct`: `direct` is an
 * answer (a visit with no referrer and no tag), while an org with no row means
 * the hand-over never happened. Inside the window below it should read zero, so a
 * non-zero value there is a bug to chase, which is why the card shows it.
 *
 * Alias-free (only zod) so it carries real unit tests.
 */
import { z } from "zod";

/** When the dashboard started handing the first touch over (distribute.you #4426).
 *  Orgs created before it carry no record by construction, so the window starts here. */
export const FIRST_TOUCH_CAPTURE_START = "2026-09-26T06:05:00Z";

export const NOT_RECORDED = "not_recorded";

const AcquisitionSchema = z.object({ channel: z.string().min(1) }).passthrough();

export const AcquisitionListSchema = z.object({
  orgs: z.array(
    z
      .object({
        orgId: z.string(),
        createdAt: z.string(),
        real: z.boolean(),
        acquisition: AcquisitionSchema.nullable(),
      })
      .passthrough(),
  ),
});
export type AcquisitionList = z.infer<typeof AcquisitionListSchema>;

const LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  cold_email: "Cold email",
  paid_search: "Google Ads / paid search",
  paid_social: "Paid social",
  organic_search: "Search",
  ai_assistant: "AI assistant",
  social: "Social",
  email: "Email (other)",
  partner: "Partner link",
  referral: "Referral site",
  other: "Other tagged link",
  direct: "Direct",
  unknown: "Unknown (no cookie)",
  [NOT_RECORDED]: "Not recorded",
};

/** A channel the producer adds later reads verbatim rather than blank. */
export function channelLabel(channel: string): string {
  return LABELS[channel] ?? channel;
}

export interface ChannelRow {
  channel: string;
  label: string;
  signedUp: number;
  started: number;
}

export interface ChannelBreakdown {
  rows: ChannelRow[];
  totalSignedUp: number;
  totalStarted: number;
}

/** One row per channel, most signups first, then most setup starts, then name. */
export function channelBreakdown(list: AcquisitionList): ChannelBreakdown {
  const byChannel = new Map<string, ChannelRow>();
  for (const org of list.orgs) {
    const channel = org.acquisition?.channel ?? NOT_RECORDED;
    const row = byChannel.get(channel) ?? { channel, label: channelLabel(channel), signedUp: 0, started: 0 };
    if (org.real) row.signedUp += 1;
    else row.started += 1;
    byChannel.set(channel, row);
  }
  const rows = [...byChannel.values()].sort(
    (a, b) => b.signedUp - a.signedUp || b.started - a.started || a.label.localeCompare(b.label),
  );
  return {
    rows,
    totalSignedUp: rows.reduce((n, r) => n + r.signedUp, 0),
    totalStarted: rows.reduce((n, r) => n + r.started, 0),
  };
}
