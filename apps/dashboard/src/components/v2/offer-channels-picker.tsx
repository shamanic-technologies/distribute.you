"use client";

import { SectionTitle } from "@/components/v2/ui";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { channelMarkForSlug } from "@/lib/acquisition-channels";
import type { SalesPathChannel } from "@/lib/offer-active-sales-paths";

/**
 * The CHANNELS an offer accepts (Sales path page, above Legs): every channel a sales path
 * can use, as features-service lists them, ticked when the offer accepts it. Same card as
 * a Step: on = accent fill + check + full-weight name, off = plain and muted. The sales
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
            <button
              key={c.slug}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(c.slug, !on)}
              className={`k-card flex items-center gap-2.5 p-3 text-left transition-[box-shadow,background-color] duration-150 active:scale-[0.99] ${on ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]" : "k-hover"}`}
            >
              <AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }} size="xs" dimmed={!on} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[13px] ${on ? "k-fg font-semibold" : "k-fg3"}`}>{c.name}</span>
                <span className="k-fg3 block truncate text-[11.5px]">
                  {c.customerOperated ? "Your team" : c.managed ? "We run it" : "Not run by us yet"}
                </span>
              </span>
              {on ? (
                <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white">✓</span>
              ) : (
                <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border border-[var(--line-strong)]" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
