"use client";

import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import { ProviderLogo } from "@/components/provider-logo";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";
import { useProfileLists } from "@/components/v2/use-profile-lists";
import { heldByProfile, listsOfOrigin, profileOf, signalLabelOf } from "@/lib/profile-lists";

const STATUS_WORD: Record<string, string> = { active: "Active", paused: "Paused", archived: "Archived" };

/**
 * Sourcing > Lists by profile (owner 2026-10-09, human-service v0.50.0): each source lists
 * one entry per client profile it looks for, "Heads of QA (Hiring now)". A profile paused on
 * Targeting pauses its lists (human-service does it); a list held that way says so. Reads
 * are the Targeting page's own (`useProfileLists`); archived lists are not shown.
 */
export function OfferSourceLists({ brandId, offerId }: { brandId: string; offerId: string }) {
  const p = useProfileLists(brandId, offerId);
  const pending = !p.settled || !p.originsSettled;
  const groups = p.origins
    .filter((o) => o.live)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((o) => ({ origin: o, lists: listsOfOrigin(o, p.audiences, p.origins) }))
    .filter((g) => g.lists.length > 0);

  return (
    <section className="mt-8">
      <SectionTitle>Lists by profile</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">Each source looks for each profile. Pausing a profile pauses its lists.</p>
      {p.error ? (
        <p className="text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s lists.</p>
      ) : pending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Shimmer className="h-32 rounded-[12px]" />
          <Shimmer className="h-32 rounded-[12px]" />
        </div>
      ) : groups.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No list yet for this offer.</EmptyNote>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(({ origin, lists }) => (
            <div key={origin.slug} className="k-card h-fit overflow-hidden">
              <div className="k-line-subtle flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  {origin.provider ? <ProviderLogo domain={origin.provider.domain} size={16} className="shrink-0 rounded-[4px]" /> : null}
                  <span className="truncate text-[13px] font-medium">{origin.name}</span>
                </span>
                <span className="k-fg3 text-[12px] tabular-nums">
                  {lists.length} {lists.length === 1 ? "list" : "lists"}
                </span>
              </div>
              <ul>
                {lists.map((l) => {
                  const profile = profileOf(l, p.byId);
                  const held = heldByProfile(l, profile);
                  // A list built for no profile (an older whole-target list) says so.
                  const name = profile?.name ?? "All profiles";
                  const sub = [profile ? null : l.name, signalLabelOf(l)].filter((v, i, all) => v && all.indexOf(v) === i).join(" · ");
                  return (
                    <li key={l.id} className="k-row k-line-subtle flex h-12 items-center justify-between gap-3 border-b px-4 last:border-b-0">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <AudienceAvatar name={name} avatarUrl={profile?.avatarUrl ?? l.avatarUrl} size={24} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px]">{name}</span>
                          {sub ? <span className="k-fg3 block truncate text-[12px]">{sub}</span> : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <StateDot running={l.status === "active"} label={STATUS_WORD[l.status] ?? l.status} />
                        {held ? <span className="k-fg3 block text-[12px]">Profile {profile?.status}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
