"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { StartShell, StartButton, fromPerDay } from "./start-shell";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { channelMarkForSlug } from "@/lib/acquisition-channels";
import { salesFunnelDefForWireKeyOrNull } from "@/lib/sales-funnels";
import { getStripe } from "@/lib/stripe";
import {
  ApiError,
  chargeSavedCard,
  createEmbeddedCheckoutSession,
  getBillingAccount,
} from "@/lib/api";
import {
  channelsForOutcomes,
  funnelsForChannels,
  pairKeysFromSelection,
  type CatalogueChannel,
  type StartCatalogue,
} from "@/lib/start-catalogue";
import {
  dayOneCharge,
  payStep,
  committedDailyCents,
  dayOneIdempotencyKey,
  chargeOutcomeFor,
  chargeOutcomeMessage,
  type PayableFunnel,
} from "@/lib/pay-plan";
import {
  decodeStartSelection,
  startSelectionCookieAssignment,
  START_SELECTION_COOKIE,
  type StartSelection,
} from "@/lib/start-selection-cookie";

/**
 * PAYING FOR THE FUNNELS, ONE AT A TIME.
 *
 * The visitor arrives here straight from signup with their picks in the cookie.
 * Each funnel gets its own screen: what it costs a day, how long before it can
 * be judged, and a CTA that charges the first day. The first charge goes through
 * embedded checkout, which SAVES the card; every one after it is an inline
 * charge against that card, so nobody is ever redirected off this page.
 *
 * Skipping drops the funnel from the selection rather than deferring it -- there
 * is no "later" in this flow -- and the last unpaid funnel cannot be skipped
 * when nothing has been bought yet, because a flow that ends having sold nothing
 * hands somebody a dashboard with no campaign behind it.
 *
 * NOTHING IS WRITTEN AGAINST A BRAND HERE, because there is no brand yet: the
 * domain is asked for on the next screens. Billing charges the ORG, so the money
 * is real and lands as credit; the per-funnel daily budgets are written once the
 * brand exists.
 */

const dollars = (cents: number): string =>
  `$${Math.round(cents / 100).toLocaleString("en-US")}`;

/** The funnel's own tile, or nothing for a funnel this app draws no mark for.
 *  Tolerant by design — see `start-flow`: the producer publishes more funnels
 *  than this app holds marks for, and the name comes off the wire. */
function funnelMark(wireKey: string) {
  const def = salesFunnelDefForWireKeyOrNull(wireKey);
  return def ? <SalesFunnelMark def={def} size="md" /> : null;
}

/** Exact, for the one number a card is actually charged. */
const exactDollars = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PayFlow() {
  const router = useRouter();
  const [selection, setSelection] = useState<StartSelection | null>(null);
  // The producer's catalogue whole. Every screen of the signed-out flow is derived
  // from it, so the three of them cannot disagree about what is on sale.
  const [wire, setWire] = useState<StartCatalogue | null>(null);
  const channels = wire?.channels ?? null;
  const [catalogueError, setCatalogueError] = useState(false);

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [embeddedSecret, setEmbeddedSecret] = useState<string | null>(null);

  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${START_SELECTION_COOKIE}=`))
      ?.slice(START_SELECTION_COOKIE.length + 1);
    setSelection(decodeStartSelection(raw));
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/public/catalogue")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (!live) return;
        const cat = body?.channels;
        setWire({
          channels: cat?.channels ?? cat ?? [],
          funnels: cat?.funnels ?? [],
          legs: cat?.legs ?? [],
          steps: cat?.steps ?? [],
        });
      })
      .catch((err) => {
        console.error("[pay] catalogue read failed:", err);
        if (live) setCatalogueError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const remember = useCallback((next: StartSelection) => {
    document.cookie = startSelectionCookieAssignment(next);
    setSelection(next);
  }, []);

  const payable: PayableFunnel[] = useMemo(() => {
    if (!wire || !selection) return [];
    const kept = channelsForOutcomes(wire, selection.outcomes).filter((c) =>
      selection.channels.includes(c.slug),
    );
    return funnelsForChannels(kept, selection.outcomes, wire);
  }, [wire, selection]);

  // A row is one (funnel x channel) pair, and so is a payment. The stored selection is
  // read tolerantly: a cookie written when it named funnels still resolves, because
  // `paid` is the only record that money was taken before the brand exists.
  const step = useMemo(
    () =>
      payStep(
        payable,
        pairKeysFromSelection(selection?.funnels ?? [], payable),
        pairKeysFromSelection(selection?.paid ?? [], payable),
      ),
    [payable, selection],
  );

  // Every picked funnel decided: the money is taken, so the brand-building
  // screens are what comes next. Replaced rather than pushed, so Back cannot
  // walk somebody into a payment screen for a funnel they already paid.
  useEffect(() => {
    if (!selection || !channels) return;
    if (step.current === null && selection.paid.length > 0) {
      router.replace("/onboarding/build");
    }
  }, [step.current, selection, channels, router]);

  if (catalogueError) {
    return (
      <StartShell
        step={1}
        stepCount={1}
        title="We could not load what you picked"
        subtitle="Nothing has been charged. Reload and it should come back."
        footer={<StartButton onClick={() => window.location.reload()}>Try again</StartButton>}
      >
        <span />
      </StartShell>
    );
  }

  if (!selection || !channels) return <PaySkeleton />;

  // A visitor who reached this URL without picking anything has nothing to pay
  // for. Send them to make the picks rather than showing an empty payment page.
  if (step.total === 0) {
    return (
      <StartShell
        step={1}
        stepCount={1}
        title="Pick what you want us to run first"
        subtitle="We need at least one revenue funnel before we can start anything."
        footer={<StartButton onClick={() => router.push("/start")}>Choose what to run</StartButton>}
      >
        <span />
      </StartShell>
    );
  }

  if (step.current === null) return <PaySkeleton />;

  const funnel = step.current;
  const charge = dayOneCharge(funnel);

  async function pay() {
    setBusy(true);
    setProblem(null);
    try {
      const account = await getBillingAccount();
      if (!account.has_payment_method) {
        // First funnel: embedded checkout takes the money AND saves the card, so
        // every funnel after this one settles without leaving the page.
        const { client_secret } = await createEmbeddedCheckoutSession(charge.amountCents);
        setEmbeddedSecret(client_secret);
        return;
      }
      await chargeSavedCard(
        charge.amountCents,
        dayOneIdempotencyKey(account.org_id, funnel.key),
      );
      markPaid();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? (err.body?.code as string | null) ?? null : null;
      const outcome = chargeOutcomeFor(status, code);
      console.error(`[pay] ${funnel.key} charge failed (${status} ${code ?? "no code"}):`, err);
      if (outcome === "needs_card") {
        // Nothing chargeable on file: fall back to checkout, which is the one
        // path that can capture a card.
        try {
          const { client_secret } = await createEmbeddedCheckoutSession(charge.amountCents);
          setEmbeddedSecret(client_secret);
          return;
        } catch (inner) {
          console.error("[pay] checkout fallback failed:", inner);
        }
      }
      setProblem(chargeOutcomeMessage(outcome));
    } finally {
      setBusy(false);
    }
  }

  function markPaid() {
    if (!selection) return;
    remember({ ...selection, paid: [...selection.paid, funnel.key] });
  }

  function skip() {
    if (!selection) return;
    remember({ ...selection, funnels: selection.funnels.filter((k) => k !== funnel.key) });
  }

  // Stripe fires this when the embedded session completes. The card and the
  // credit land via the webhook, so the saved card is not visible instantly —
  // the funnel is marked paid on the MONEY, which has been taken by now, and the
  // next screen's own read waits for the card before it charges.
  async function onCheckoutComplete() {
    setEmbeddedSecret(null);
    markPaid();
  }

  if (embeddedSecret) {
    return (
      <StartShell
        step={step.position}
        stepCount={step.total}
        title={`Pay the first day of ${funnel.name}`}
        subtitle="Your card is saved so the funnels after this one settle without another form."
        footer={
          <button
            type="button"
            onClick={() => setEmbeddedSecret(null)}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        }
      >
        <EmbeddedCheckoutProvider
          stripe={getStripe()}
          options={{ clientSecret: embeddedSecret, onComplete: onCheckoutComplete }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </StartShell>
    );
  }

  const committed = committedDailyCents(payable, selection.paid);

  return (
    <StartShell
      step={step.position}
      stepCount={step.total}
      title={
        <span className="flex items-center gap-3">
          {funnelMark(funnel.key)}
          {funnel.name}
        </span>
      }
      subtitle={funnel.steps.join(" → ")}
      footer={
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step.canSkip ? (
            <button
              type="button"
              onClick={skip}
              disabled={busy}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
            >
              Not this one
            </button>
          ) : (
            <span />
          )}
          <StartButton onClick={pay} busy={busy}>
            {busy ? "Taking payment..." : `Pay ${exactDollars(charge.amountCents)} for the first day`}
          </StartButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-gray-600">What it costs to run</span>
            <span className="font-display text-2xl font-medium text-gray-900">
              {fromPerDay(funnel.dailyOperatingCostCents)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            One day is charged now. After that you pay only what is spent, and you can stop
            whenever you want.
          </p>
          {charge.flooredByStripeMinimum && (
            <p className="mt-2 text-xs text-gray-500">
              Our payment provider will not take less than{" "}
              {exactDollars(charge.amountCents)}, so that is today&apos;s charge. The difference
              stays as credit and pays for the days after.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Runs through <span className="font-medium text-gray-900">one channel</span>,
            the one this row buys it through. Give it{" "}
            {funnel.effectiveMinimumCommitmentDays} days before judging it. That is how
            long a result takes to show, not a commitment.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[funnel.channelSlug].map((slug) => (
              <span key={slug} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-2.5 text-xs text-gray-700">
                <AcquisitionChannelMark def={{ mark: channelMarkForSlug(slug) }} size="xs" />
                {channels?.find((c) => c.slug === slug)?.name ?? slug}
              </span>
            ))}
          </div>
        </div>

        {committed > 0 && (
          <p className="text-sm text-gray-500">
            So far you have committed {dollars(committed)} per day across{" "}
            {selection.paid.length === 1 ? "1 funnel" : `${selection.paid.length} funnels`}.
          </p>
        )}

        {problem && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {problem}
          </p>
        )}
      </div>
    </StartShell>
  );
}

function PaySkeleton() {
  return (
    <StartShell step={1} stepCount={1} title="Setting up your payment" footer={<span />}>
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </StartShell>
  );
}
