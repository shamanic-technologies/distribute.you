"use client";

import Link from "next/link";
import { getBillingAccount, getSubscription, type BillingAccount } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { budgetGaugeView } from "@/lib/budget-gauge";
import { v2Base } from "@/lib/v2/routes";
import { Meter, Shimmer } from "./ui";

/**
 * What is left to spend, fixed at the bottom of the sidebar above the account menu
 * (owner 2026-10-11). Its shape follows how the org pays (`lib/budget-gauge`); the whole
 * card opens Billing. Same `["billingAccount"]` and `["subscription"]` keys as the
 * Billing page, so the two never state different money and it costs no new request.
 */
export function BudgetGauge({ orgId, brandId }: { orgId: string; brandId: string }) {
  const account = useAuthQuery<BillingAccount>(["billingAccount"], () => getBillingAccount());
  const isPlan = account.data?.payment_mode === "subscription";
  const plan = useAuthQuery(["subscription"], () => getSubscription(), { enabled: isPlan });

  const answered = account.isFetchedAfterMount || account.data !== undefined;
  if (!answered) return <GaugeFrame href={null}><Shimmer className="h-3 w-16" /><Shimmer className="mt-2 h-5 w-24" /><Shimmer className="mt-2 h-2 w-full" /></GaugeFrame>;
  if (!account.data) {
    console.error("[budget-gauge] billing account read failed", account.error);
    return <GaugeFrame href={null}><p className="k-fg3 text-[12px]">We could not load your balance.</p></GaugeFrame>;
  }

  const view = budgetGaugeView(account.data, isPlan ? plan.data : undefined);
  const href = `${v2Base(orgId, brandId)}/billing`;
  if (view === null) {
    if (plan.isError) {
      console.error("[budget-gauge] subscription read failed", plan.error);
      return <GaugeFrame href={href}><p className="k-fg3 text-[12px]">We could not load your plan.</p></GaugeFrame>;
    }
    return <GaugeFrame href={null}><Shimmer className="h-3 w-16" /><Shimmer className="mt-2 h-5 w-24" /><Shimmer className="mt-2 h-2 w-full" /></GaugeFrame>;
  }
  if ("error" in view) {
    console.error("[budget-gauge] cannot draw billing's answer", { error: view.error, account: account.data });
    return <GaugeFrame href={href}><p className="k-fg3 text-[12px]">We could not read how you pay.</p></GaugeFrame>;
  }

  return (
    <GaugeFrame href={href}>
      <div className="flex items-center justify-between gap-2">
        <span className="k-label truncate">{view.label}</span>
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: view.tone === "ok" ? "var(--run)" : "var(--data-rose)" }}
        />
      </div>
      <div className="mt-1 text-[18px] font-medium leading-6 tabular-nums">{view.figure}</div>
      {view.meter && <Meter value={view.meter.value} max={view.meter.max} className="mt-2" />}
      <p className={`mt-1.5 truncate text-[12px] tabular-nums ${view.tone === "ok" ? "k-fg3" : "text-[var(--data-rose)]"}`}>{view.line}</p>
    </GaugeFrame>
  );
}

function GaugeFrame({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = "k-card block px-3 py-2.5";
  return (
    <div className="px-2 pb-1 pt-2">
      {href ? (
        <Link href={href} className={`${cls} hover:bg-[var(--bg-hover)]`} aria-label="Open Billing">
          {children}
        </Link>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </div>
  );
}
