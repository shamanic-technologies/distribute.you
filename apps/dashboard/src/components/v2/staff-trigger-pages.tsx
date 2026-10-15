"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EmptyNote, KeyHint, MarkLines, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { useRowKeys } from "@/components/v2/records";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { useOngoingCatalogue, useStaffCatalogueObject, useStaffCatalogueTriggers, type OngoingFunnelCampaign } from "@/components/v2/staff-catalogue-data";
import { CatalogueTable, Fact, OngoingDot, TableSkeleton } from "@/components/v2/staff-catalogue-pages";
import { v2CatalogueHref } from "@/lib/v2/routes";
import { catalogueStatusLabel, TRIGGER_LABELS, type CatalogueTriggerRow } from "@/lib/staff-catalogue";

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const TD = "px-3 py-2 first:pl-4 last:pr-4";

/** `coded` as the producer means it: a service fires it today, or nothing does yet. */
function FiredStatus({ coded }: { coded: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      {coded ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
      ) : (
        <span className="h-2 w-2 rounded-full border-[1.5px] border-[var(--fg-3)]" />
      )}
      {coded ? "Fired today" : "Not fired yet"}
    </span>
  );
}

function TriggerMark({ row, size }: { row: Pick<CatalogueTriggerRow, "icon" | "color" | "name">; size: number }) {
  return <CatalogueMark icon={row.icon} color={row.color} name={row.name} size={size} />;
}

/**
 * The offer's ongoing funnel campaigns this trigger starts: their funnel's served `trigger`
 * (the funnel's head, owner 2026-10-15), never a pipe it runs (a trigger-headed funnel may run
 * only proactive pipes).
 */
function campaignsStartedBy(campaigns: OngoingFunnelCampaign[], triggerId: string): OngoingFunnelCampaign[] {
  return campaigns.filter((c) => c.trigger?.slug === triggerId);
}

function CampaignChips({ campaigns }: { campaigns: OngoingFunnelCampaign[] }) {
  if (campaigns.length === 0) return <span className="k-fg4">—</span>;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {campaigns.map(({ campaign, face }) => (
        <span key={campaign.id} className="inline-flex min-w-0 items-center gap-1.5">
          <CatalogueMark face={face} name={campaign.salesFunnelName} size={16} />
          <span className="truncate">{campaign.salesFunnelName}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * The trigger card table: lightning mark, unique name (its line under it), the step that fires
 * it, who fires it, the reactive pipes naming it (served count), and whether anything fires it today.
 */
function TriggerTable({
  rows,
  ongoing,
  campaignsOf,
  hrefOf,
  cursorId,
  footer,
}: {
  rows: CatalogueTriggerRow[];
  ongoing?: Set<string>;
  /** Present on the Ongoing table: the offer's campaigns running on each trigger. */
  campaignsOf?: (row: CatalogueTriggerRow) => OngoingFunnelCampaign[];
  hrefOf: (row: CatalogueTriggerRow) => string;
  cursorId?: string | null;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b">
              <th className={TH}>Name</th>
              <th className={TH}>Fires on</th>
              {campaignsOf ? <th className={TH}>Campaigns</th> : <th className={TH}>Fired by</th>}
              <th className={`${TH} text-right`}>Pipes</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = hrefOf(r);
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(href)}
                  className={`k-row k-line-subtle cursor-pointer border-b last:border-b-0 ${cursorId === r.id ? "k-selected" : ""}`}
                >
                  <td className={TD}>
                    <Link href={href} onClick={(e) => e.stopPropagation()} className="block min-w-0">
                      <MarkLines mark={(px) => <TriggerMark row={r} size={px} />}>
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{r.name}</span>
                          {ongoing?.has(r.id) && <OngoingDot />}
                        </span>
                        <span className="k-fg3 block truncate text-[12px]">{r.line}</span>
                      </MarkLines>
                    </Link>
                  </td>
                  <td className={`${TD} k-fg2`}>{r.fromStepName ?? <span className="k-fg4">—</span>}</td>
                  {campaignsOf ? (
                    <td className={TD}>
                      <CampaignChips campaigns={campaignsOf(r)} />
                    </td>
                  ) : (
                    <td className={`${TD} k-mono k-fg2 text-[12px]`}>{r.firedBy}</td>
                  )}
                  <td className={`${TD} text-right tabular-nums`}>{r.pipeCount}</td>
                  <td className={TD}>
                    <FiredStatus coded={r.coded} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">{footer}</div>}
    </div>
  );
}

/**
 * TRIGGERS overview (owner 2026-10-11, staff): the ones the selected offer's running campaigns
 * use (an ongoing funnel's served trigger, its head), then every trigger, searchable.
 */
export function TriggersOverviewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const router = useRouter();
  const { offerId } = useSelectedOffer();
  const ongoing = useOngoingCatalogue(orgId, brandId, offerId, true);
  const ongoingRows = ongoing.triggers;
  const ongoingIds = useMemo(() => new Set(ongoingRows.map((r) => r.id)), [ongoingRows]);
  const campaignsOf = (r: CatalogueTriggerRow) => campaignsStartedBy(ongoing.campaigns, r.id);

  const [q, setQ] = useState("");
  const list = useStaffCatalogueTriggers({ limit: "25", q: q.trim() || undefined });
  const answered = list.data !== undefined || list.isFetchedAfterMount;
  const rows = list.data?.rows ?? [];
  const href = (r: CatalogueTriggerRow) => v2CatalogueHref(orgId, brandId, "triggers", r.id);

  const flat = useMemo(() => [...ongoingRows.map((r) => `o:${r.id}`), ...rows.map((r) => `c:${r.id}`)], [ongoingRows, rows]);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useRowKeys({
    count: flat.length,
    cursor,
    setCursor,
    onOpen: (i) => {
      const k = flat[i];
      if (k) router.push(v2CatalogueHref(orgId, brandId, "triggers", k.slice(2)));
    },
    searchRef,
  });
  const cursorKey = cursor >= 0 ? flat[cursor] ?? null : null;

  return (
    <>
      <TopBar crumbs={[{ label: TRIGGER_LABELS.title }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {ongoing.settled && list.data ? `${ongoingRows.length} of ${list.data.total} triggers ongoing` : TRIGGER_LABELS.title}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">{TRIGGER_LABELS.what} Ongoing means a running campaign of this offer waits on it.</p>
          </div>
          {ongoing.settled && (
            <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
              <span className={`h-1.5 w-1.5 rounded-full ${ongoingRows.length ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {ongoingRows.length} ongoing now
            </span>
          )}
        </div>

        <section className="mt-6">
          <SectionTitle count={ongoing.settled ? ongoingRows.length : null}>Ongoing</SectionTitle>
          {!ongoing.settled && ongoingRows.length === 0 ? (
            <TableSkeleton rows={2} />
          ) : ongoingRows.length === 0 ? (
            <div className="k-card">
              <EmptyNote>No running campaign of this offer waits on a trigger.</EmptyNote>
            </div>
          ) : (
            <TriggerTable rows={ongoingRows} campaignsOf={campaignsOf} hrefOf={href} cursorId={cursorKey?.startsWith("o:") ? cursorKey.slice(2) : null} />
          )}
        </section>

        <section className="mt-8">
          <SectionTitle
            count={list.data?.total ?? null}
            right={
              <>
                <KeyHint keys={["J", "K"]} label="move" />
                <KeyHint keys={["↵"]} label="open" />
              </>
            }
          >
            All triggers
          </SectionTitle>
          <div className="mb-3">
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search triggers" aria-label="Search triggers" className="k-input w-full max-w-[320px]" />
          </div>
          {!answered ? (
            <TableSkeleton />
          ) : list.isError && !list.data ? (
            <div className="k-card">
              <EmptyNote>Could not read the triggers.</EmptyNote>
            </div>
          ) : rows.length === 0 ? (
            <div className="k-card">
              <EmptyNote>No trigger matches.</EmptyNote>
            </div>
          ) : (
            <TriggerTable
              rows={rows}
              ongoing={ongoingIds}
              hrefOf={href}
              cursorId={cursorKey?.startsWith("c:") ? cursorKey.slice(2) : null}
              footer={list.data?.truncated ? `Showing ${rows.length} of ${list.data.total}. Search to find the rest.` : `${rows.length} ${rows.length === 1 ? "trigger" : "triggers"}`}
            />
          )}
        </section>
      </div>
    </>
  );
}

/** ONE trigger's page: its mark and name, the reactive pipes it starts, and this offer's campaigns running on them. */
export function TriggerPage({ id }: { id: string }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId } = useSelectedOffer();
  const q = useStaffCatalogueObject("triggers", id);
  const ongoing = useOngoingCatalogue(orgId, brandId, offerId, true);
  const d = q.data;
  const isOngoing = ongoing.triggers.some((t) => t.id === id);
  const ongoingPipes = useMemo(() => new Set(ongoing.pipes.map((p) => p.id)), [ongoing.pipes]);
  const running = useMemo(() => campaignsStartedBy(ongoing.campaigns, id), [id, ongoing.campaigns]);

  return (
    <>
      <TopBar
        crumbs={[
          { label: TRIGGER_LABELS.title, href: v2CatalogueHref(orgId, brandId, "triggers") },
          {
            label: d ? (
              <span className="inline-flex items-center gap-1.5">
                <TriggerMark row={d} size={16} />
                {d.name}
              </span>
            ) : (
              "…"
            ),
          },
        ]}
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {!q.data && !q.isFetchedAfterMount ? (
          <Shimmer className="h-40 rounded-xl" />
        ) : !d ? (
          <div className="k-card">
            <EmptyNote>Could not read this trigger.</EmptyNote>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-4">
              <TriggerMark row={d} size={40} />
              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{d.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {isOngoing && <StateDot running label="Ongoing" />}
                  <FiredStatus coded={d.coded} />
                  <span className="k-chip">{catalogueStatusLabel(d.kind)}</span>
                </div>
              </div>
            </div>
            <p className="k-fg2 mt-3 text-[14px]">{d.line}</p>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-8">
                <section>
                  <SectionTitle count={running.length}>Running for this offer</SectionTitle>
                  {!ongoing.settled && running.length === 0 ? (
                    <TableSkeleton rows={1} />
                  ) : running.length === 0 ? (
                    <div className="k-card">
                      <EmptyNote>No running campaign of this offer waits on this trigger.</EmptyNote>
                    </div>
                  ) : (
                    <div className="k-card overflow-hidden">
                      {running.map(({ campaign, face }) => (
                        <Link
                          key={campaign.id}
                          href={v2CatalogueHref(orgId, brandId, "campaigns", campaign.id)}
                          className="k-row k-line-subtle flex h-10 items-center gap-2.5 border-b px-4 text-[13px] last:border-b-0"
                        >
                          <CatalogueMark face={face} name={campaign.salesFunnelName} size={20} />
                          <span className="truncate font-medium">{campaign.salesFunnelName}</span>
                          <OngoingDot />
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <SectionTitle count={d.pipes.length}>Reactive pipes it starts</SectionTitle>
                  {d.pipes.length === 0 ? (
                    <div className="k-card">
                      <EmptyNote>No reactive pipe waits on this trigger yet.</EmptyNote>
                    </div>
                  ) : (
                    <CatalogueTable
                      object="pipes"
                      rows={d.pipes}
                      costUnit="per_outcome"
                      ongoing={ongoingPipes}
                      hrefOf={(r) => v2CatalogueHref(orgId, brandId, "pipes", r.id)}
                    />
                  )}
                </section>
              </div>
              <aside className="k-card h-fit p-4">
                <dl>
                  <Fact label="Event">
                    <span className="inline-flex items-center gap-1.5">
                      <CatalogueMark icon={d.eventIcon} name={d.name} size={16} />
                      {d.name}
                    </span>
                  </Fact>
                  <Fact label="Fires on">
                    {d.fromStep ? (
                      <Link href={v2CatalogueHref(orgId, brandId, "steps", d.fromStep)} className="hover:underline">
                        {d.fromStepName ?? d.fromStep}
                      </Link>
                    ) : null}
                  </Fact>
                  <Fact label="Fired by">
                    <span className="k-mono text-[12px]">{d.firedBy}</span>
                  </Fact>
                  <Fact label="Origin">{catalogueStatusLabel(d.origin)}</Fact>
                  {d.params && (
                    <Fact label="Params">
                      <span className="k-mono k-fg2 break-all text-[12px]">{JSON.stringify(d.params)}</span>
                    </Fact>
                  )}
                  <Fact label="Id">
                    <span className="k-mono k-fg2 break-all text-[12px]">{d.id}</span>
                  </Fact>
                </dl>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}
