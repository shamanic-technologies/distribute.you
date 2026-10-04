"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPath, getOfferSalesPaths, saveOfferSalesPath } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { v2OfferHref } from "@/lib/v2/routes";
import { SALES_PATH_CHANNEL_SLUGS, type SalesPathSelection } from "@/lib/offer-sales-path";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";
import { OfferSalesPath } from "@/components/v2/offer-sales-path";
import { OfferSalesPaths } from "@/components/v2/offer-sales-paths";
import { BrandSalesBudgetCard } from "@/components/v2/brand-sales-budget-card";
import { useDailyBudgetHidden } from "@/lib/use-daily-budget-hidden";
import { firstLaunchedPath } from "@/lib/v2/get-started";

/**
 * How an offer sells, read from the top down: the path we run (Active, framed) above the
 * other paths, then the legs, then the steps they are built from. The steps and legs the customer ticks, saved per offer
 * in brand-service, over features-service's catalogue. Every tick is saved at once;
 * the page holds what was just ticked until brand-service answers, then shows its answer.
 */
export function V2OfferSalesPathPage() {
  const p = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const { orgId, brandId, offerId } = p;
  const name = useOfferName(brandId, offerId);
  const budgetHidden = useDailyBudgetHidden();
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  const qc = useQueryClient();

  const q = useAuthQuery(["offerSalesPath", brandId, offerId], () => getOfferSalesPath(brandId, offerId), {
    enabled: !!offerId,
  });
  // The paths are features-service's answer over the SAVED selection, so they re-read
  // after every save (below) rather than on a poll.
  const paths = useAuthQuery(["offerSalesPaths", brandId, offerId], () => getOfferSalesPaths(brandId, offerId), {
    enabled: !!offerId,
  });
  const [draft, setDraft] = useState<SalesPathSelection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const served = useMemo<SalesPathSelection | null>(
    () => (q.data ? { steps: new Set(q.data.steps ?? []), legs: new Set(q.data.legKeys ?? []) } : null),
    [q.data],
  );
  useEffect(() => setDraft(null), [served]);

  const channelNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const slug of SALES_PATH_CHANNEL_SLUGS) {
      names.set(slug, channels.find((c) => c.featureSlug === slug)?.name ?? slug);
    }
    return names;
  }, [channels]);

  const onChange = (next: SalesPathSelection) => {
    setDraft(next);
    setError(null);
    saveOfferSalesPath(brandId, offerId, [...next.steps], [...next.legs])
      .then((saved) => {
        qc.setQueryData(["offerSalesPath", brandId, offerId], saved);
        return qc.invalidateQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
      })
      .catch((err) => {
        console.error("[offer-sales-path] save failed", err);
        setDraft(null);
        setError("Could not save this change. Try again.");
      });
  };

  // The path we run: the same pick as the onboarding and campaign-service's global budget
  // (best-ranked path a channel of ours enters). The customer never chooses it.
  const activeKey = useMemo(() => firstLaunchedPath(paths.data?.paths ?? [])?.combinationKey ?? null, [paths.data]);

  const selection = draft ?? served;
  const settled = q.isFetchedAfterMount || q.data !== undefined;

  return (
    <V2Page
      crumbs={[
        { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) },
        { label: "Sales path" },
      ]}
      title={name ?? " "}
      sub="We always run the path with the best return. Tick legs and steps below to change the options."
      width="max-w-[1280px]"
    >
      {error && <p className="mb-4 text-[13px] text-[var(--data-rose)]">{error}</p>}
      <OfferSalesPaths
        data={paths.data}
        pending={paths.isPending && !paths.isError}
        failed={paths.isError}
        activeKey={activeKey}
        intro=""
      />
      <div className="mt-8">
      {!settled || catalogue.legs.size === 0 ? (
        <div className="space-y-2">
          <Shimmer className="h-12 rounded-[10px]" />
          <Shimmer className="h-12 rounded-[10px]" />
          <Shimmer className="h-12 rounded-[10px]" />
        </div>
      ) : q.isError && !selection ? (
        <EmptyNote>Could not read this offer&apos;s sales path.</EmptyNote>
      ) : (
        <OfferSalesPath
          catalogue={catalogue}
          channelNames={channelNames}
          selection={selection ?? { steps: new Set(), legs: new Set() }}
          onChange={onChange}
          legsFirst
        />
      )}
      </div>
      <div className="mt-8 space-y-8">
        {/* A plan's $50/day is fixed (owner 2026-10-03): no budget card for a subscriber. */}
        {budgetHidden ? null : <BrandSalesBudgetCard brandId={brandId} />}
      </div>
    </V2Page>
  );
}
