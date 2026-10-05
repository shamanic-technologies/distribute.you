"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getOfferChannels,
  getOfferSalesPath,
  getOfferSalesPaths,
  getOfferSelectedSalesPaths,
  saveOfferChannels,
  saveOfferSalesPath,
  saveOfferSelectedSalesPaths,
  applyReactiveDefaults,
} from "@/lib/api";
import { invalidateCampaignMoney } from "@/lib/write-invalidation";
import { useSalesPathChannels } from "@/lib/use-sales-path-channels";
import { acceptedChannels, selectedPathKeys, toggleChannel, togglePath } from "@/lib/offer-active-sales-paths";
import { OfferChannelsPicker } from "@/components/v2/offer-channels-picker";
import { OfferCampaigns } from "@/components/v2/offer-campaigns";
import { campaignsOfOffer } from "@/lib/offer-campaigns";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { v2OfferHref } from "@/lib/v2/routes";
import { SALES_PATH_CHANNEL_SLUGS, type SalesPathSelection } from "@/lib/offer-sales-path";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";
import { OfferSalesPath } from "@/components/v2/offer-sales-path";
import { OfferSalesPaths } from "@/components/v2/offer-sales-paths";

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
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  const qc = useQueryClient();

  const q = useAuthQuery(["offerSalesPath", brandId, offerId], () => getOfferSalesPath(brandId, offerId), {
    enabled: !!offerId,
  });
  // The paths are features-service's answer over the SAVED selection, so they re-read
  // after every save (below) rather than on a poll. The page LISTS every path of the ticked
  // legs x the accepted channels, as a plain table: what runs is stated by campaigns, not here.
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: !!offerId },
  );
  const [draft, setDraft] = useState<SalesPathSelection | null>(null);

  // The channels the offer accepts (brand-service); the catalogue paths are filtered on them.
  const eligible = useSalesPathChannels();
  const offerChannels = useAuthQuery(["offerChannels", brandId, offerId], () => getOfferChannels(brandId, offerId), {
    enabled: !!offerId,
  });
  const [channelDraft, setChannelDraft] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => setChannelDraft(null), [offerChannels.data]);
  const accepted = useMemo(
    () => channelDraft ?? (offerChannels.data ? acceptedChannels(offerChannels.data, SALES_PATH_CHANNEL_SLUGS) : null),
    [channelDraft, offerChannels.data],
  );
  const onToggleChannel = (slug: string, on: boolean) => {
    if (!accepted) return;
    const next = toggleChannel(accepted, slug, on);
    setChannelDraft(new Set(next));
    setError(null);
    saveOfferChannels(brandId, offerId, next)
      .then((saved) => {
        qc.setQueryData(["offerChannels", brandId, offerId], saved);
        // A prefix: the catalogue list is filtered on the accepted channels.
        return qc.invalidateQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
      })
      .catch((err) => {
        console.error("[offer-sales-path] channels save failed", err);
        setChannelDraft(null);
        setError("Could not save this change. Try again.");
      });
  };
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
        // A prefix: re-reads every sales paths read of this offer.
        return qc.invalidateQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
      })
      .catch((err) => {
        console.error("[offer-sales-path] save failed", err);
        setDraft(null);
        setError("Could not save this change. Try again.");
      });
  };

  // The paths the customer ticked (brand-service); never stated = every path above 1x.
  const selectedQ = useAuthQuery(["offerSelectedSalesPaths", brandId, offerId], () => getOfferSelectedSalesPaths(brandId, offerId), {
    enabled: !!offerId,
  });
  const [pathDraft, setPathDraft] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => setPathDraft(null), [selectedQ.data]);
  const selectedPaths = useMemo(
    () => pathDraft ?? (selectedQ.data && paths.data ? selectedPathKeys(selectedQ.data, paths.data.paths) : null),
    [pathDraft, selectedQ.data, paths.data],
  );
  const onTogglePath = (key: string, on: boolean) => {
    if (!selectedPaths) return;
    const next = togglePath(selectedPaths, key, on);
    setPathDraft(new Set(next));
    setError(null);
    saveOfferSelectedSalesPaths(brandId, offerId, next)
      .then((saved) => {
        qc.setQueryData(["offerSelectedSalesPaths", brandId, offerId], saved);
        // The reactive campaigns the ticked paths use turn on (campaign-service, owner 2026-10-05).
        return applyReactiveDefaults(brandId, offerId).then(() => {
          invalidateCampaignMoney(qc);
          // The campaigns and their ROI are features-service's answer over the ticked paths.
          return qc.invalidateQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
        });
      })
      .catch((err) => {
        console.error("[offer-sales-path] path selection save failed", err);
        setPathDraft(null);
        setError("Could not save this change. Try again.");
      });
  };

  // Every channel x leg the TICKED paths use (owner 2026-10-05), as features-service serves
  // them with their ROI; a campaign no ticked path uses is not listed.
  const campaigns = useMemo(
    () => campaignsOfOffer(paths.data?.campaigns ?? [], paths.data?.paths ?? [], roiUnavailableLabel),
    [paths.data],
  );

  const selection = draft ?? served;
  const settled = q.isFetchedAfterMount || q.data !== undefined;

  return (
    <V2Page
      crumbs={[
        { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) },
        { label: "Sales path" },
      ]}
      title={name ?? " "}
      sub="Every way this offer can sell, best return first."
      width="max-w-[1280px]"
    >
      {error && <p className="mb-4 text-[13px] text-[var(--data-rose)]">{error}</p>}
      {selectedQ.isError && !selectedQ.data && (
        <p className="mb-4 text-[13px] text-[var(--data-rose)]">Could not read which sales paths you ticked.</p>
      )}
      <div className="mb-8">
        <OfferCampaigns
          orgId={orgId}
          brandId={brandId}
          offerId={offerId}
          campaigns={campaigns}
          pending={(paths.isPending && !paths.isError) || (!selectedPaths && !selectedQ.isError)}
        />
      </div>
      <OfferSalesPaths
        data={paths.data}
        pending={paths.isPending && !paths.isError}
        failed={paths.isError}
        table
        selected={selectedPaths ?? undefined}
        onToggleSelected={selectedPaths ? onTogglePath : undefined}
        intro=""
      />
      <div className="mt-8">
        {!eligible.settled || !accepted ? (
          offerChannels.isError || (eligible.settled && eligible.channels.length === 0) ? (
            <EmptyNote>Could not read the channels.</EmptyNote>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <Shimmer className="h-[58px] rounded-[12px]" />
              <Shimmer className="h-[58px] rounded-[12px]" />
              <Shimmer className="h-[58px] rounded-[12px]" />
              <Shimmer className="h-[58px] rounded-[12px]" />
            </div>
          )
        ) : (
          <OfferChannelsPicker channels={eligible.channels} accepted={accepted} onToggle={onToggleChannel} />
        )}
      </div>
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
    </V2Page>
  );
}
