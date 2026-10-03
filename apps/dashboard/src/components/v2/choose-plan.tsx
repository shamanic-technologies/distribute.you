"use client";

import { useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import {
  ApiError,
  createEmbeddedCardSetup,
  getBillingAccount,
  saveCampaignBudget,
  startPlan,
  type BillingAccount,
} from "@/lib/api";
import { useQueryClient } from "@/lib/use-auth-query";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useOfferNeedsPlan } from "@/lib/use-plans";
import { getStripe } from "@/lib/stripe";
import {
  SUBSCRIPTION_AMOUNT_OPTIONS_CENTS,
  SUBSCRIPTION_MONTHLY_CENTS,
  monthlyUsd,
  planStartRefusal,
  subscriptionBudgets,
} from "@/lib/subscription-plan";
import type { Mission } from "@/components/v2/use-missions";

/**
 * "Choose your plan" for ONE brand x offer (owner 2026-10-03): a plan is per brand x
 * offer, bought from the dashboard with NO trial (the 3 days are the first signup's
 * only), the first month charged on the card on file. With no card on file, the card
 * form opens in the page and the plan starts once the card is saved.
 *
 * The plan's $50/day is never shown here or anywhere: it is not a choice.
 */
export function ChoosePlanPanel({
  brandId,
  offerId,
  onStarted,
  onRefused,
  beforeCard,
  personName,
  email,
}: {
  brandId: string;
  offerId: string;
  /** Called once billing answered the plan is live. */
  onStarted: () => void | Promise<void>;
  /** A refusal the caller handles itself (returns true); the rest are stated here. */
  onRefused?: (code: unknown) => boolean;
  /** Anything the org must declare before its first card form (a new org's acquirer). */
  beforeCard?: () => Promise<void>;
  personName?: string | null;
  email?: string | null;
}) {
  const queryClient = useQueryClient();
  const [cents, setCents] = useState<number>(SUBSCRIPTION_MONTHLY_CENTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardSecret, setCardSecret] = useState<string | null>(null);

  async function start(): Promise<"started" | "card_required" | "handled"> {
    try {
      await startPlan({ brand_id: brandId, offer_id: offerId, monthly_amount_cents: cents });
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: unknown } | null)?.code : null;
      if (code === "card_required") return "card_required";
      if (onRefused?.(code)) return "handled";
      console.error("[dashboard v2] plan start refused", err);
      throw new Error(planStartRefusal(code));
    }
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["subscriptionPlans"] }),
      queryClient.refetchQueries({ queryKey: ["billingAccount"] }),
    ]);
    await onStarted();
    return "started";
  }

  async function afterCardSaved() {
    setCardSecret(null);
    setBusy(true);
    setError(null);
    try {
      // The saved card reaches billing through the provider's webhook a moment later.
      let acct: BillingAccount | null = null;
      for (let i = 0; i < 10; i++) {
        acct = await getBillingAccount().catch((e) => {
          console.error("[dashboard v2] billing read after card save failed", e);
          return null;
        });
        if (acct?.has_payment_method) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!acct?.has_payment_method) throw new Error("Your card is still being confirmed. Wait a few seconds and press the button again.");
      if ((await start()) === "card_required") throw new Error("Your card is still being confirmed. Wait a few seconds and press the button again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The plan did not start. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openCard() {
    if (beforeCard) await beforeCard();
    const setup = await createEmbeddedCardSetup();
    if (setup.mode === "embedded_checkout") {
      setCardSecret(setup.client_secret);
      return;
    }
    if (setup.mode === "embedded_widget") {
      const { openCardWidget } = await import("@/lib/card-setup-widget");
      await openCardWidget({
        token: setup.token,
        environment: setup.environment,
        savePaymentMethodFor: setup.save_payment_method_for,
        name: setup.customer_name ?? personName ?? undefined,
        email: setup.customer_email ?? email ?? undefined,
        onSuccess: () => void afterCardSaved(),
        onCancel: () => {},
        onError: (message) => setError(message),
      });
      return;
    }
    console.error("[dashboard v2] card setup answered a hosted page to an in-page request", setup);
    throw new Error("We could not open the card form here. Add a card from Billing, then come back.");
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if ((await start()) === "card_required") await openCard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The plan did not start. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (cardSecret) {
    return (
      <div className="grid gap-2">
        <p className="k-fg text-[13px] font-medium">Add your card</p>
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: cardSecret, onComplete: () => void afterCardSaved() }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="k-fg text-[14px] font-medium">Choose your plan</p>
        <p className="k-fg2 mt-0.5 text-[13px]">One plan per offer. You pay today. Cancel anytime.</p>
      </div>
      <label className="grid gap-1.5">
        <span className="k-label">Monthly plan</span>
        <select
          aria-label="Monthly plan"
          className="k-input w-40 px-2.5 tabular-nums"
          value={cents}
          disabled={busy}
          onChange={(e) => setCents(Number(e.target.value))}
        >
          {SUBSCRIPTION_AMOUNT_OPTIONS_CENTS.map((c) => (
            <option key={c} value={c}>
              {monthlyUsd(c)} / month
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-[13px] text-[var(--data-rose)]">
          {error}
        </p>
      )}
      <button type="button" className="k-cta k-btn-accent w-full justify-center" onClick={() => void submit()} disabled={busy}>
        {busy ? "Starting your plan..." : `Start my plan, ${monthlyUsd(cents)} a month`}
      </button>
    </div>
  );
}

/**
 * Funds an offer's missions at the plan's figures once its plan started: the first
 * outbound mission $50/day, the first reply mission $25/day, the same rule onboarding
 * writes (`subscriptionBudgets`). Missions with no leg have no budget address.
 */
export async function fundOfferOnPlan(brandId: string, offerId: string, missions: readonly Mission[]): Promise<void> {
  const mine = missions.filter((m) => m.offerId === offerId && m.row.campaign.legKey && m.row.campaign.featureSlug);
  const usd = subscriptionBudgets(mine.map((m) => ({ key: m.row.campaign.id, fromKey: m.leg?.fromKey ?? null })));
  for (const m of mine) {
    const dollars = Number(usd[m.row.campaign.id] ?? "0");
    if (dollars <= 0) continue;
    await saveCampaignBudget(
      brandId,
      { offerId, legKey: m.row.campaign.legKey!, featureSlug: m.row.campaign.featureSlug! },
      dollars * 100,
    );
  }
}

/**
 * On a plan org, an offer with no plan does not send: one line saying so and the plan
 * picker one click away (owner 2026-10-03: a banner once the offer is set up). Renders
 * nothing until billing answered, and nothing for an org that is not on plans.
 */
export function OfferPlanBanner({
  brandId,
  offerId,
  missions,
}: {
  brandId: string;
  offerId: string | null;
  missions: readonly Mission[];
}) {
  const queryClient = useQueryClient();
  const needsPlan = useOfferNeedsPlan(brandId, offerId);
  const [open, setOpen] = useState(false);
  if (needsPlan !== true || !offerId) return null;
  return (
    <div className="k-card mb-6 p-4">
      {open ? (
        <ChoosePlanPanel
          brandId={brandId}
          offerId={offerId}
          onStarted={async () => {
            await fundOfferOnPlan(brandId, offerId, missions);
            invalidateCampaignMoney(queryClient);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px]">
            <span className="font-medium">This offer has no plan yet.</span>{" "}
            <span className="k-fg2">Choose one to start sending.</span>
          </p>
          <button type="button" className="k-btn-accent" onClick={() => setOpen(true)}>
            Choose a plan
          </button>
        </div>
      )}
    </div>
  );
}
