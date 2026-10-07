"use client";

import { useState } from "react";
import { SectionTitle } from "@/components/v2/ui";
import { SelectCard } from "@/components/v2/select-card";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { channelMarkForSlug } from "@/lib/acquisition-channels";
import { channelSelectable, type SalesPathChannel } from "@/lib/offer-active-sales-paths";
import { ChannelContactModal } from "@/components/v2/channel-contact-modal";

/**
 * The CHANNELS an offer accepts (Sales path page, above Legs): every channel a sales path
 * can use, as features-service lists them, ticked when the offer accepts it. Same card as
 * a Step (`SelectCard`): on = accent fill + check + full-weight name, off = plain and muted. The sales
 * paths above are filtered on the ticked channels by features-service. Your-team channels
 * are not shown; a channel we do not run yet is a "Contact us" card: a click opens a form
 * (what they want, the budget they have in mind) that emails staff right away. In staff
 * mode a few of those (`STAFF_ACTIVABLE_CHANNEL_SLUGS`, LinkedIn Posting) tick like the others.
 */
export function OfferChannelsPicker({
  channels,
  accepted,
  onToggle,
  orgId,
  brandId,
  offerId,
  staffMode,
}: {
  channels: readonly SalesPathChannel[];
  accepted: ReadonlySet<string>;
  onToggle: (slug: string, on: boolean) => void;
  orgId: string;
  brandId: string;
  offerId: string;
  staffMode: boolean;
}) {
  const shown = channels.filter((c) => !c.customerOperated);
  const [contact, setContact] = useState<SalesPathChannel | null>(null);
  return (
    <section>
      <SectionTitle count={shown.filter((c) => channelSelectable(c, staffMode) && accepted.has(c.slug)).length}>Channels</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">The channels your sales paths may use.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((c) => {
          const selectable = channelSelectable(c, staffMode);
          const on = selectable && accepted.has(c.slug);
          return (
            <SelectCard
              key={c.slug}
              on={on}
              onClick={() => (selectable ? onToggle(c.slug, !on) : setContact(c))}
              mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }} size="xs" dimmed={!on} />}
              title={c.name}
              sub={c.shortDescription}
              wrapSub
              contactUs={!selectable}
            />
          );
        })}
      </div>
      {contact && (
        <ChannelContactModal
          channel={{ slug: contact.slug, name: contact.name }}
          mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(contact.slug) }} size="xs" />}
          orgId={orgId}
          brandId={brandId}
          offerId={offerId}
          onClose={() => setContact(null)}
        />
      )}
    </section>
  );
}
