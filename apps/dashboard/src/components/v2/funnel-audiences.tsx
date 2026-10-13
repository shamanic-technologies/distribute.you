"use client";

import { useMemo } from "react";
import { listAudiences, type AudienceWire } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import { statedAudienceIds, type SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * WHICH AUDIENCES A CAMPAIGN WORKS (LEAK-1012). A sales funnel campaign states its audiences on
 * campaign-service (`audienceIds`, handed to every unit); naming none, it works every audience of
 * the brand, so two campaigns of one offer can take each other's people. The page shows the set,
 * the campaign's modal changes it. Names and marks are human-service's rows, never derived.
 */

/** The audiences a campaign may pick from: the offer's live ones (active, paused), plus any it already names. */
const PICKABLE = new Set(["active", "paused"]);
const LIMIT = 200;

/** The offer's audiences, every status but deprecated (human-service's default read). One key under ["audiences", brandId]. */
export function useOfferAudiences(brandId: string, offerId: string) {
  return useAuthQuery(
    ["audiences", brandId, "funnel-pick", offerId],
    async () => {
      const res = await listAudiences(brandId, { offerId, limit: LIMIT });
      if (res.total > res.audiences.length) {
        console.error("[funnel-audiences] the offer holds more audiences than one read returns", { brandId, offerId, total: res.total, read: res.audiences.length });
      }
      return res.audiences;
    },
    { enabled: !!brandId && !!offerId, ...pollOptions },
  );
}

/** What the picker lists: live audiences, plus every stated one whatever its status (so it can be unticked). */
export function pickableAudiences(all: AudienceWire[], stated: string[] | null): AudienceWire[] {
  const named = new Set(stated ?? []);
  return all.filter((a) => PICKABLE.has(a.status) || named.has(a.id));
}

function StatusWord({ status }: { status: string }) {
  if (status === "active") return null;
  return <span className="k-fg3 text-[12px]">{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

/** One audience as a chip: its mark and its name. */
function AudienceChip({ a }: { a: AudienceWire }) {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-[var(--bg-inset)] pl-0.5 pr-2.5 text-[13px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
      <AudienceAvatar name={a.name} avatarUrl={a.avatarUrl} size={24} />
      <span className="truncate">{a.name}</span>
      <StatusWord status={a.status} />
    </span>
  );
}

/** The campaign page's "Audiences" section: the stated set as chips, or "All your audiences". */
export function FunnelAudiencesSection({ campaign, onChange }: { campaign: SalesFunnelCampaign; onChange: () => void }) {
  const q = useOfferAudiences(campaign.brandId, campaign.offerId);
  const stated = statedAudienceIds(campaign);
  const byId = useMemo(() => new Map((q.data ?? []).map((a) => [a.id, a])), [q.data]);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  return (
    <section>
      <SectionTitle
        count={stated ? stated.length : null}
        right={
          <button type="button" className="k-btn-ghost h-6" onClick={onChange}>
            Change
          </button>
        }
      >
        Audiences
      </SectionTitle>
      <div className="k-card px-4 py-3">
        {stated === null ? (
          <div>
            <p className="text-[13px]">All your audiences</p>
            <p className="k-fg3 text-[12px]">Pick some so two campaigns never reach the same people.</p>
          </div>
        ) : !settled ? (
          <div className="flex gap-2">
            <Shimmer className="h-7 w-32 rounded-full" />
            <Shimmer className="h-7 w-24 rounded-full" />
          </div>
        ) : q.isError && !q.data ? (
          <EmptyNote>Could not read your audiences. Retrying.</EmptyNote>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stated.map((id) => {
              const a = byId.get(id);
              if (!a) {
                console.error("[funnel-audiences] a stated audience is not among the offer's audiences", { campaignId: campaign.id, audienceId: id });
                return (
                  <span key={id} className="k-fg3 inline-flex h-7 items-center text-[12px]">
                    An audience we could not find
                  </span>
                );
              }
              return <AudienceChip key={id} a={a} />;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The modal's audience choice: "All" (names none) or "Only these" with a tick per audience.
 * `picked` null = All. Controlled by the modal, which writes it with its one Save.
 */
export function FunnelAudiencePicker({
  brandId,
  offerId,
  stated,
  picked,
  onPick,
  problem,
}: {
  brandId: string;
  offerId: string;
  stated: string[] | null;
  picked: string[] | null;
  onPick: (next: string[] | null) => void;
  problem: string | null;
}) {
  const q = useOfferAudiences(brandId, offerId);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const list = useMemo(() => pickableAudiences(q.data ?? [], stated), [q.data, stated]);
  const only = picked !== null;
  const toggle = (id: string) => {
    const cur = picked ?? [];
    onPick(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="k-label">Audiences</span>
        <div role="radiogroup" aria-label="Audiences" className="inline-flex shrink-0 rounded-[8px] bg-[var(--bg-inset)] p-0.5">
          {[
            { key: "all", label: "All", on: !only, pick: () => onPick(null) },
            { key: "only", label: "Only these", on: only, pick: () => onPick(picked ?? []) },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={o.on}
              onClick={o.pick}
              className={`h-6 rounded-[6px] px-2.5 text-[12px] transition-colors ${o.on ? "font-medium" : "k-fg2 hover:text-[var(--fg-1)]"}`}
              style={o.on ? { background: "var(--bg-raised)", boxShadow: "0 0 0 1px var(--line), 0 1px 2px rgb(0 0 0 / 0.06)" } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {!only ? (
        <p className="k-fg3 mt-1.5 text-[12px] leading-[18px]">This campaign reaches all your audiences.</p>
      ) : !settled ? (
        <div className="mt-2 space-y-1.5">
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-full" />
        </div>
      ) : q.isError && !q.data ? (
        <p className="mt-1.5 text-[12px] leading-[18px] text-[var(--data-rose)]">Could not read your audiences. Retrying.</p>
      ) : list.length === 0 ? (
        <p className="k-fg3 mt-1.5 text-[12px] leading-[18px]">This offer has no audience yet.</p>
      ) : (
        <ul className="k-scroll mt-2 max-h-[220px] overflow-y-auto rounded-[8px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
          {list.map((a) => {
            const on = picked?.includes(a.id) ?? false;
            return (
              <li key={a.id} className="border-b border-[var(--line-subtle)] last:border-b-0">
                <label className="k-row flex h-10 cursor-pointer items-center gap-2.5 px-3">
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]" />
                  <AudienceAvatar name={a.name} avatarUrl={a.avatarUrl} size={24} />
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${on ? "" : "k-fg2"}`}>{a.name}</span>
                  <StatusWord status={a.status} />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {problem && <p className="mt-1.5 text-[12px] leading-[18px] text-[var(--data-rose)]">{problem}</p>}
    </div>
  );
}
