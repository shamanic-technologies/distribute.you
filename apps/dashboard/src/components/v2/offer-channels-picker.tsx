"use client";

import { SectionTitle } from "@/components/v2/ui";
import { SelectCard } from "@/components/v2/select-card";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { channelMarkForSlug } from "@/lib/acquisition-channels";
import type { SalesPathChannel } from "@/lib/offer-active-sales-paths";

/**
 * The CHANNELS an offer accepts (Sales path page, above Legs): every channel a sales path
 * can use, as features-service lists them, ticked when the offer accepts it. Same card as
 * a Step (`SelectCard`): on = accent fill + check + full-weight name, off = plain and muted. The sales
 * paths above are filtered on the ticked channels by features-service.
 */
export function OfferChannelsPicker({
  channels,
  accepted,
  onToggle,
}: {
  channels: readonly SalesPathChannel[];
  accepted: ReadonlySet<string>;
  onToggle: (slug: string, on: boolean) => void;
}) {
  return (
    <section>
      <SectionTitle count={channels.filter((c) => accepted.has(c.slug)).length}>Channels</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">The channels your sales paths may use.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {channels.map((c) => {
          const on = accepted.has(c.slug);
          return (
            <SelectCard
              key={c.slug}
              on={on}
              onClick={() => onToggle(c.slug, !on)}
              mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }} size="xs" dimmed={!on} />}
              title={c.name}
              sub={c.customerOperated ? "Your team" : c.managed ? "We run it" : "Not run by us yet"}
            />
          );
        })}
      </div>
    </section>
  );
}
