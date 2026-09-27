import type { ChannelBreakdown } from "../lib/acquisition-breakdown";
import { formatCount } from "../lib/format-number";

/**
 * Signups and signed-out setup starts, by the channel that FIRST brought each org.
 *
 * No client directive: it holds no state and takes no function prop, so the server
 * page renders it directly (see the server-boundary rule in CLAUDE.md).
 *
 * Two bars per channel, deliberately NOT stacked: a setup start that later signs
 * up becomes a signup, so the two are separate populations and adding them
 * would count nothing real.
 */
export function SignupsByChannelCard({
  breakdown,
  since,
  error,
}: {
  breakdown: ChannelBreakdown | null;
  since: string;
  error: string | null;
}) {
  const sinceLabel = new Date(since).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const max = breakdown ? Math.max(1, ...breakdown.rows.map((r) => Math.max(r.signedUp, r.started))) : 1;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">Signups by first-touch channel</h2>
      <p className="mt-1 text-sm text-gray-500">
        The channel that first brought each org, recorded once and never overwritten. Orgs created since {sinceLabel}, when
        recording started; older orgs have no source.
      </p>
      {error && <p className="mt-4 text-sm text-red-600">Could not read the sources: {error}</p>}
      {breakdown && breakdown.rows.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No org has been created since {sinceLabel}.</p>
      )}
      {breakdown && breakdown.rows.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-500" /> Signed up ({formatCount(breakdown.totalSignedUp)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gray-400" /> Started setup, not signed up yet (
              {formatCount(breakdown.totalStarted)})
            </span>
          </div>
          <div className="mt-3 divide-y divide-gray-100">
            {breakdown.rows.map((row) => (
              <div
                key={row.channel}
                data-channel={row.channel}
                className="grid gap-2 py-3 sm:grid-cols-[12rem_1fr_6rem] sm:items-center"
              >
                <p className="truncate text-sm font-medium text-gray-900" title={row.channel}>
                  {row.label}
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.signedUp / max) * 100}%` }} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-400" style={{ width: `${(row.started / max) * 100}%` }} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 sm:text-right">
                  <span className="font-semibold text-gray-950">{formatCount(row.signedUp)}</span> ·{" "}
                  {formatCount(row.started)}
                </p>
              </div>
            ))}
          </div>
          {breakdown.rows.some((r) => r.channel === "not_recorded") && (
            <p className="mt-3 text-xs text-gray-500">
              &ldquo;Not recorded&rdquo; means the hand-over never reached client-service for that org, which should not
              happen after {sinceLabel}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
