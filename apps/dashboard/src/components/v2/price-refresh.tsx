"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffEmailSendPrice, getStaffRealCosts, getStaffSubscriptionCosts } from "@/lib/api";
import { Figure, Shimmer, StatTile } from "@/components/v2/ui";
import { refreshProblems, refreshWords, utcToday, type PriceSeriesLike, type RefreshProblem } from "@/lib/monitoring/price-refresh";

/**
 * A costs-service price series that did not refresh is RED (PRICE-REFRESH-RED-1107, owner rule: red on Monitoring,
 * never an email; red only when broken). The status line beside each pricing page's day, the red block listing each
 * reason (one line per vendor, listed first on the page), and the hub tile above the collapsible rows.
 */

const RED = "var(--data-rose)";
const DOT = { fresh: "var(--data-teal)", due: "var(--data-amber)", broken: RED } as const;
const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

/** "Refreshed today" (teal), "Not refreshed today" (amber, today's run not done yet), "Not refreshed for N days" (red). */
export function RefreshStatus({ s, children }: { s: PriceSeriesLike; children?: React.ReactNode }) {
  const { state, words } = refreshWords(s, utcToday());
  return (
    <span className="inline-flex items-center gap-2" style={{ color: state === "broken" ? RED : undefined }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[state] }} aria-hidden="true" />
      {words}
      {children}
    </span>
  );
}

/** Every reason the prices are broken, one red line each; nothing when none. */
export function RefreshProblems({ problems }: { problems: RefreshProblem[] }) {
  if (!problems.length) return null;
  return (
    <div className="k-card p-4" role="alert" style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${RED} 40%, transparent)` }}>
      <p className="k-label" style={{ color: RED }}>
        Prices not refreshed
      </p>
      <ul className="mt-2 space-y-1.5 text-[13px]">
        {problems.map((p) => (
          <li key={p.key} className="flex min-w-0 items-start gap-2" style={{ color: RED }}>
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: RED }} aria-hidden="true" />
            <span className="min-w-0 break-words">{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The page-level block for one series. */
export function SeriesRefreshProblems({ s, what }: { s: PriceSeriesLike; what: string }) {
  return <RefreshProblems problems={refreshProblems(s, what, utcToday())} />;
}

/** Hub tile: every daily price series costs-service refreshes, red while one is broken. */
export function PriceRefreshTile({ href }: { href: string }) {
  const real = useAuthQuery(["staffRealCosts", null], () => getStaffRealCosts(null), ONCE);
  const send = useAuthQuery(["staffEmailSendPrice"], getStaffEmailSendPrice, ONCE);
  const subs = useAuthQuery(["staffSubscriptionCosts"], getStaffSubscriptionCosts, ONCE);
  const today = utcToday();
  const reads = [
    { q: real, what: "Real costs" },
    { q: send, what: "Email sending price" },
    { q: subs, what: "Subscription prices" },
  ];
  const settled = reads.every((r) => r.q.data !== undefined || r.q.isError);
  const problems = reads.flatMap((r) => (r.q.data ? refreshProblems(r.q.data, r.what, today) : []));
  const unreadable = reads.filter((r) => r.q.isError && !r.q.data).map((r) => r.what);
  return (
    <StatTile label="Price refresh" note="daily, every vendor" href={href}>
      <Figure
        value={
          !settled ? (
            <Shimmer className="h-6 w-16" />
          ) : problems.length ? (
            <span style={{ color: RED }}>{`${problems.length} broken`}</span>
          ) : unreadable.length ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : (
            "All refreshed"
          )
        }
        sub={problems.length ? <span title={problems.map((p) => p.text).join("\n")}>{problems[0].text}</span> : unreadable.length ? unreadable.join(", ") : undefined}
      />
    </StatTile>
  );
}
