"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getCreditGrants, type CreditGrant } from "@/lib/api";
import { formatGrantedTotal, totalGrantedCents } from "@/lib/reward-credits";
import { COUNT_UP_MS, countUpValue, shouldAnimate } from "@/lib/count-up";
import { burstConfetti } from "@/lib/confetti";
import { useBrandRewardTasks } from "@/lib/use-reward-tasks";

/**
 * The free credit this org has earned, in the top bar.
 *
 * ## Why it is in the bar at all
 *
 * The bar deliberately carries no product mark and no breadcrumb — identity and
 * navigation live in the sidebar, and the bar keeps only UNIVERSAL actions and
 * state. A running total of what you have earned is exactly that: it is true on
 * every page, it belongs to no scope, and it is the same class of thing as a
 * balance. So it sits beside the account button and nowhere else.
 *
 * It does NOT re-open the breadcrumb question: this is a number, not a path.
 *
 * ## What it counts
 *
 * The whole grants ledger (`reward-credits.ts` explains why a subset would rot).
 * It reads the SAME query key the Billing page polls, so it costs no request of
 * its own and paints from the on-disk cache on the first frame.
 *
 * ## When it moves
 *
 * A count-up, a pop and a confetti burst fire ONLY when the total INCREASES
 * from a value this surface has already seen — never on a first paint, never on
 * a restore, never on a decrease. An animation that fires when nothing happened
 * is a signal the reader learns to ignore, which would cost us the one moment
 * it exists for. The rule lives in `count-up.ts` as a pure function so it is
 * pinned by real tests rather than by reading this component.
 *
 * Reduced motion is honoured all the way down: the number lands instantly and
 * no confetti renders at all.
 *
 * ## Colour
 *
 * The brand ramp (`bg-brand-50` / `border-brand-200` / `text-brand-700`), never
 * a literal hex — `:root[data-brand-tint]` re-declares that ramp at the open
 * brand's hue, so the pill is the customer's colour rather than ours. All three
 * classes carry an `html.dark` remap AND an `html.dark[data-brand-tint]` one,
 * checked in `globals.css` rather than assumed.
 */
export function RewardCreditsPill() {
  const pathname = usePathname();

  // The badge counts what is DUE on the brand in view, and nothing else. A count
  // of tasks the reader cannot act on from where they are is a nag rather than a
  // signal, so off a brand route there is no badge at all. This is the SAME key
  // the reward band polls, so the badge costs no request of its own.
  const brandId = pathname.split("/")[4] === "brands" ? (pathname.split("/")[5] ?? null) : null;
  const { data: rewardTasks } = useBrandRewardTasks(brandId);
  const dueCount = rewardTasks?.rollup?.brand?.dueCount ?? 0;

  // The same key the Billing page polls → one request, and an instant first
  // paint from the persisted cache (`creditGrants` is an allowlisted root).
  const { data, isError } = useAuthQuery<{ grants: CreditGrant[] }>(["creditGrants"], () =>
    getCreditGrants(),
  );

  const total = data ? totalGrantedCents(data.grants) : null;

  // The value last SEEN by this surface. `null` until the first total lands,
  // which is what makes a first paint refuse to animate.
  const seen = useRef<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [popping, setPopping] = useState(false);
  const anchor = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (total === null) return;

    const previous = seen.current;
    seen.current = total;

    if (!shouldAnimate(previous, total)) {
      setShown(total);
      return;
    }

    // An increase: celebrate, then count from where the reader was looking.
    setPopping(true);
    burstConfetti(anchor.current);
    const popTimer = window.setTimeout(() => setPopping(false), 600);

    const from = previous as number;
    const started = performance.now();
    let frame = 0;
    const step = () => {
      const elapsed = performance.now() - started;
      setShown(countUpValue(from, total, elapsed));
      if (elapsed < COUNT_UP_MS) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => {
      window.clearTimeout(popTimer);
      cancelAnimationFrame(frame);
    };
  }, [total]);

  // Nothing measured, a failed read, or nothing earned yet: say nothing. A `$0`
  // badge is noise, and a dash beside a gift icon reads as something broken.
  if (isError || shown === null || shown <= 0) return null;

  // The org comes from the URL, the per-tab source of truth for every link in
  // this app (a Clerk active org flips across tabs).
  const billingHref = `/orgs/${pathname.split("/")[2] ?? ""}/billing`;

  return (
    <Link
      ref={anchor}
      href={billingHref}
      title="Free credits you have earned. Opens your billing page."
      aria-label={`${formatGrantedTotal(shown)} in free credits earned`}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-transform duration-300 hover:bg-brand-100 ${
        popping ? "scale-110" : "scale-100"
      }`}
    >
      <GiftIcon />
      <span className="tabular-nums">{formatGrantedTotal(shown)}</span>
      {dueCount > 0 && (
        <span
          className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white tabular-nums"
          title={`${dueCount} reward ${dueCount === 1 ? "task" : "tasks"} to do on this brand`}
        >
          {dueCount}
        </span>
      )}
    </Link>
  );
}

/** A gift, drawn rather than imported: one 16px mark does not justify pulling a
 *  second icon set into the bar's bundle, and `currentColor` keeps it on the
 *  brand ramp in both themes and under a tint. */
function GiftIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 21V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
