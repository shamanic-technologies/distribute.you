"use client";

import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listAudiences, listBrandOffers } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { v2OfferHref } from "@/lib/v2/routes";
import { OfferMark } from "@/components/marks/offer-mark";
import { Shimmer } from "@/components/v2/ui";

/**
 * A campaign's Targeting tab (owner 2026-11-08, AUDIENCE-PER-OFFER-1107): a campaign sells ONE
 * offer and an offer is built for ONE audience, so the tab is that audience's text, edited on
 * the offer. Never the per-audience figures table nor a list per source (sources are a concept
 * apart from targeting). Same reads as Setup > Offers, so it costs no extra call.
 */
export function CampaignAudience({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const offersQ = useAuthQuery(["brandOffers", brandId, "withArchived"], () => listBrandOffers(brandId, undefined, { includeArchived: true }), {
    enabled: !!brandId,
  });
  const offer = offersQ.data?.offers.find((o) => o.offerId === offerId) ?? null;
  const q = useAuthQuery(["audiences", brandId, "active", offerId], () => listAudiences(brandId, { status: "active", offerId }), pollOptions);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const list = q.data?.audiences ?? null;
  const first = list?.[0] ?? null;
  const text = first ? (first.targetText ?? first.description ?? first.name) : null;
  // The text Jev judges, in spaced paragraphs, never a wall of words.
  const paragraphs = text ? text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean) : [];
  const href = v2OfferHref(orgId, brandId, offerId);
  return (
    <section className="k-card p-5">
      <div className="flex min-w-0 items-center gap-3">
        <OfferMark size="title" imageUrl={offer?.imageUrl ?? undefined} />
        <div className="min-w-0 flex-1">
          <span className="k-label">Audience</span>
          <span className="block text-[14px] font-medium [overflow-wrap:anywhere]">{offer?.name ?? " "}</span>
        </div>
        <Link href={href} className="k-btn">
          Edit on the offer
        </Link>
      </div>
      <div className="mt-4 border-t border-[var(--line-subtle)] pt-4">
        {!settled ? (
          <div className="space-y-2">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-4/5" />
          </div>
        ) : !list ? (
          <p className="k-fg3 text-[13px]">Could not read the audience. Retrying.</p>
        ) : paragraphs.length === 0 ? (
          <p className="k-fg3 text-[13px]">No audience yet. Write who this offer is for on the offer.</p>
        ) : (
          <div className="k-fg2 max-w-3xl space-y-3 text-[13px] leading-[20px]">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
