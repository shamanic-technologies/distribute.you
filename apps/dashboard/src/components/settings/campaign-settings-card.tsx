"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  getBrandFunnelBudgets,
  getCampaign,
  saveBrandFunnelBudget,
  type BrandFunnelBudgets,
  type Campaign,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { offerScopedCents } from "@/lib/funnel-channels";
import {
  FUNNEL_MIN_DAILY_BUDGET_USD,
  SALES_FUNNELS,
  funnelBudgetBelowMinimum,
  funnelBudgetFloorMessage,
  normalizeSalesFunnelKey,
  type SalesFunnelDef,
  type SalesFunnelKey,
} from "@/lib/sales-funnels";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import { Skeleton } from "@/components/skeleton";

/**
 * Campaign Settings — the daily budget, and nothing else.
 *
 * A campaign IS (offer x sales funnel x acquisition channel), and billing keys a
 * ceiling on exactly that triple, so the money on this page is this campaign's
 * own — not a mirror of one, and not a figure some other surface also owns a
 * separate copy of. Offer Settings edits the same stored row for every channel of
 * a funnel at once; this page edits the one channel its campaign runs. Two
 * windows onto ONE number, which is why the narrowing they both read
 * (`offerScopedCents`) lives in one place.
 *
 * ZERO is the whole point of the screen and is an ordinary value, not an error:
 * it is how a customer stops this campaign without losing anything they told us
 * about how it sells. Everything else about the campaign survives a zero, and
 * raising it again is one number.
 *
 * DELIBERATELY NOT ON THIS PAGE:
 *   - the campaign's NAME, its audiences, its services and its click destination.
 *     Those were here and are gone: what a campaign says and who it says it to
 *     are statements about the OFFER, which has its own Settings page, and
 *     restating them per campaign put four editable copies of the offer's answer
 *     one click below the offer itself.
 *   - the offer, the funnel, the channel, the feature. Those are what the campaign
 *     IS. Changing one does not configure this campaign, it makes it another one.
 *
 * The floor binds the FUNNEL, not this campaign: a customer splitting one funded
 * funnel across two offers must not be refused for each half being under a bar
 * the whole clears. billing holds the same rule and its 400 is what decides.
 */

/** What a campaign's budget row is, once its coordinates resolve. */
interface Scope {
  def: SalesFunnelDef;
  featureSlug: string;
  channelName: string;
}

/**
 * The (funnel, channel) a campaign's money is keyed on, or null.
 *
 * A campaign that names neither — the pre-funnel campaigns, which predate the
 * model — has no ceiling to point at, and guessing one would offer to spend money
 * against a row billing would refuse. So the card says so instead.
 */
export function campaignBudgetScope(campaign: Campaign): Scope | null {
  if (!campaign.funnelKey || !campaign.featureSlug) return null;
  let key: SalesFunnelKey;
  try {
    key = normalizeSalesFunnelKey(campaign.funnelKey);
  } catch {
    // A funnel spelling shipped upstream that this catalogue does not carry yet.
    // Refusing to render beats editing a ceiling under the wrong funnel's floor.
    return null;
  }
  const def = SALES_FUNNELS.find((f) => f.key === key);
  if (!def) return null;
  const channel = acquisitionChannelForFeatureSlug(campaign.featureSlug);
  return {
    def,
    featureSlug: campaign.featureSlug,
    channelName: channel?.name ?? campaign.featureSlug,
  };
}

/** This campaign's own stored ceiling, in cents. */
export function campaignSavedCents(
  scope: Scope,
  offerId: string,
  budgets: BrandFunnelBudgets | undefined,
): number {
  if (!budgets) return 0;
  const pairCents =
    budgets.channels === undefined
      ? (budgets.funnels.find((f) => f.funnelKey === scope.def.key)?.dailyBudgetCents ?? 0)
      : (budgets.channels.find(
          (c) => c.funnelKey === scope.def.key && c.featureSlug === scope.featureSlug,
        )?.dailyBudgetCents ?? 0);
  return offerScopedCents(
    scope.def.key,
    scope.featureSlug,
    pairCents,
    budgets.offers,
    offerId,
  );
}

/**
 * What the whole funnel would be funded at once this campaign's typed figure
 * lands — the number the floor binds.
 *
 * Computed ONLY to check the form before it is written: billing serves the funnel
 * total and holds the same rule, and its 400 is what decides. Nothing displayed
 * on this page is derived from it.
 */
export function projectedFunnelTotalUsd(
  savedFunnelCents: number,
  savedOwnCents: number,
  typedUsd: number,
): number {
  const siblings = Math.max(0, savedFunnelCents - savedOwnCents);
  return Math.round(siblings / 100) + Math.max(0, typedUsd);
}

/** A budget field holds whole dollars, or nothing. Blank is zero — the stop. */
export function parseDailyBudgetUsd(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * A refusal is rendered as OUR copy, branched on the status. `apiCall` puts the
 * whole downstream response body verbatim into `ApiError.message`, so printing
 * the message would put a JSON blob in front of a customer.
 */
export function campaignBudgetErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "That daily budget was refused. Check the amount and try again.";
    if (err.status === 403) return "You do not have access to this campaign's budget.";
    if (err.status === 404) return "This campaign no longer exists.";
    if (err.status === 409) {
      return "This funnel is sold through more than one campaign, so we could not tell which one this budget was for. Set it on Offer Settings instead.";
    }
  }
  return "We could not save this daily budget. Try again in a moment.";
}

export function CampaignSettingsCard({
  brandId,
  offerId,
  campaignId,
}: {
  brandId: string;
  offerId: string;
  campaignId: string;
}) {
  const queryClient = useQueryClient();

  // The same key the campaign Overview and the top-bar campaign name already
  // poll, so all three share one request.
  const { data: campaignData, isPending, isError } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
  );
  const campaign = campaignData?.campaign ?? null;

  // billing's ceilings, on the brand-scoped key the funnels card already reads.
  const {
    data: budgetData,
    isPending: budgetPending,
    isError: budgetError,
  } = useAuthQuery(["brandFunnelBudgets", brandId], () => getBrandFunnelBudgets(brandId));

  const scope = campaign ? campaignBudgetScope(campaign) : null;
  const savedCents = scope ? campaignSavedCents(scope, offerId, budgetData) : 0;
  const savedFunnelCents = scope
    ? (budgetData?.funnels.find((f) => f.funnelKey === scope.def.key)?.dailyBudgetCents ?? 0)
    : 0;

  // SEEDED from the query and RE-SEEDED whenever the payload is a different
  // object than the one it was built from — never a once-per-mount latch, which
  // would pin the field to the on-disk snapshot the local-first cache paints
  // first and ignore the fresher answer that lands a moment later. A field the
  // user has touched outranks the server, or it would rewrite itself mid-edit.
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [touched, setTouched] = useState(false);
  const seededFrom = useRef<BrandFunnelBudgets | null>(null);

  useEffect(() => {
    if (!budgetData || !scope || seededFrom.current === budgetData) return;
    seededFrom.current = budgetData;
    // Whole dollars, always — a daily budget is a configured ceiling, and cents
    // read wrong on one.
    const next = savedCents > 0 ? String(Math.round(savedCents / 100)) : "";
    setBaseline(next);
    if (!touched) setValue(next);
  }, [budgetData, scope, savedCents, touched]);

  const [saved, setSaved] = useState(false);

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: (cents: number) =>
      saveBrandFunnelBudget(brandId, scope!.def.key, cents, scope!.featureSlug, offerId),
    onSuccess: (set) => {
      // Write the response into the cache the page reads, THEN invalidate the
      // list the table renders — a bare invalidate would leave a failed refetch
      // showing the pre-save figure.
      queryClient.setQueryData(["brandFunnelBudgets", brandId], set);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      seededFrom.current = set;
      // Show exactly what persisted, so the field can never claim a ceiling
      // billing normalized differently.
      const persisted = scope ? campaignSavedCents(scope, offerId, set) : 0;
      const next = persisted > 0 ? String(Math.round(persisted / 100)) : "";
      setBaseline(next);
      setValue(next);
      setTouched(false);
      setSaved(true);
    },
    onError: (err) => {
      // Loud in the console (status + body), our own copy on screen.
      console.error("[dashboard] saveBrandFunnelBudget failed", err);
    },
  });

  if ((isPending || budgetPending) && !campaign) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-full max-w-xs" />
      </div>
    );
  }

  if (isError || budgetError || !campaign) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        We could not load this campaign&apos;s budget. Try again in a moment.
      </div>
    );
  }

  if (!scope) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily budget</h3>
        <p className="text-sm text-gray-500">
          This campaign predates the sales funnels, so it has no budget of its own yet. Fund it on
          Offer Settings, where each funnel states what it may spend in a day.
        </p>
      </div>
    );
  }

  // LIVE compare against the last-saved figure, never a sticky edited flag —
  // typing a value and undoing it has to disarm the button.
  const dirty = value.trim() !== baseline;
  const typed = parseDailyBudgetUsd(value);
  const blocker =
    typed === null
      ? "Enter a whole number of dollars, or leave it empty to stop this campaign."
      : funnelBudgetBelowMinimum(
            scope.def.key,
            projectedFunnelTotalUsd(savedFunnelCents, savedCents, typed),
            savedFunnelCents,
          )
        ? funnelBudgetFloorMessage(scope.def.key, savedFunnelCents)
        : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily budget</h3>
        <p className="mb-3 text-sm text-gray-500">
          The most this campaign may spend in a day, selling {scope.def.name} through{" "}
          {scope.channelName}. Set it to zero to stop it: nothing else about the campaign is lost,
          and raising it again is one number. From ${FUNNEL_MIN_DAILY_BUDGET_USD[scope.def.key]} a
          day once you do fund it.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            placeholder="0"
            onChange={(e) => {
              setTouched(true);
              setSaved(false);
              setValue(e.target.value);
            }}
            className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <span className="text-sm text-gray-500">/ day</span>
        </div>
        {savedCents === 0 && !dirty && (
          <p className="mt-2 text-xs text-gray-500">
            This campaign is not funded right now, so it is not sending.
          </p>
        )}
      </section>

      {dirty && blocker && <p className="text-sm text-red-600">{blocker}</p>}
      {error && <p className="text-sm text-red-600">{campaignBudgetErrorMessage(error)}</p>}

      <SettingsSaveRow
        dirty={dirty}
        saving={saving}
        saved={saved}
        disabled={blocker !== null}
        onSave={() => {
          if (typed === null || blocker !== null) return;
          mutate(typed * 100);
        }}
      />
    </div>
  );
}
