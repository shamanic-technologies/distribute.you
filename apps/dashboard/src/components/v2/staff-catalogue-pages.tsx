"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { EmptyNote, KeyHint, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { useRowKeys } from "@/components/v2/records";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { useOngoingCatalogue, useStaffCatalogueList, useStaffCatalogueObject, staffCatalogueObjectKey } from "@/components/v2/staff-catalogue-data";
import { getStaffCatalogueObject } from "@/lib/api";
import { useOrgQueryGate } from "@/lib/use-auth-query";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { v2CatalogueHref, v2OfferHref, v2Href, v2WorkflowHref } from "@/lib/v2/routes";
import {
  CATALOGUE_OBJECT_LABELS,
  catalogueStatusLabel,
  costUnitLabel,
  type CatalogueObject,
  type CataloguePipe,
  type CatalogueRow,
} from "@/lib/staff-catalogue";

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const TD = "px-3 py-2 first:pl-4 last:pr-4";

/** The producer's status: a dot and its own word. Measured reads done (teal); the rest is quiet. */
function CatalogueStatus({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      {status === "measured" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
      ) : (
        <span className="h-2 w-2 rounded-full border-[1.5px] border-[var(--fg-3)]" />
      )}
      {catalogueStatusLabel(status)}
    </span>
  );
}

function Usd({ v }: { v: number | null | undefined }) {
  return v == null ? <span className="k-fg4">—</span> : <span className="tabular-nums">{formatUsdAdaptive(v)}</span>;
}

function Roi({ v }: { v: number | null | undefined }) {
  return v == null ? (
    <span className="k-fg4">—</span>
  ) : (
    <span className={`tabular-nums ${roiIsGood(v) ? "text-[var(--run)]" : ""}`}>{formatRoi(v)}</span>
  );
}

export function OngoingDot() {
  return <span className="k-dot-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" aria-label="Ongoing" title="Ongoing" />;
}

/** The row a detail read becomes in a table (same fields as a list row). */
function rowOf(d: { id: string; name: string; line: string; costUsd: number | null; roi: number | null; status: string } & Record<string, unknown>): CatalogueRow {
  const face = d.face as { svgPath?: string } | string | undefined;
  return {
    id: d.id,
    name: d.name,
    line: d.line,
    costUsd: d.costUsd,
    roi: d.roi,
    status: d.status,
    icon: typeof d.icon === "string" ? d.icon : undefined,
    color: typeof d.color === "string" ? d.color : undefined,
    face: typeof face === "string" ? face : face?.svgPath,
    valueUsd: typeof d.valueUsd === "number" || d.valueUsd === null ? (d.valueUsd as number | null) : undefined,
  };
}

/**
 * The card table every catalogue list renders: the object's mark and name (its line under
 * it), its value (steps), the producer's cost in its unit, ROI and status. A row opens its page.
 */
function CatalogueTable({
  object,
  rows,
  costUnit,
  ongoing,
  hrefOf,
  cursorId,
  footer,
}: {
  object: CatalogueObject | "workflows";
  rows: CatalogueRow[];
  costUnit: string;
  ongoing?: Set<string>;
  hrefOf: (row: CatalogueRow) => string;
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
              {object === "steps" && <th className={`${TH} text-right`}>Value</th>}
              <th className={`${TH} text-right`}>{costUnitLabel(costUnit)}</th>
              <th className={`${TH} text-right`}>ROI</th>
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
                    <Link href={href} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5">
                      <CatalogueMark icon={r.icon} color={r.color} face={r.face} name={r.name} size={24} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{r.name}</span>
                          {ongoing?.has(r.id) && <OngoingDot />}
                          {r.draft && <span className="k-chip">Draft</span>}
                        </span>
                        <span className="k-fg3 block truncate text-[12px]">{r.line}</span>
                      </span>
                    </Link>
                  </td>
                  {object === "steps" && (
                    <td className={`${TD} text-right`}>
                      <Usd v={r.valueUsd} />
                    </td>
                  )}
                  <td className={`${TD} text-right`}>
                    <Usd v={r.costUsd} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <Roi v={r.roi} />
                  </td>
                  <td className={TD}>
                    <CatalogueStatus status={r.status} />
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

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="k-card overflow-hidden">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="k-row flex h-12 items-center px-4">
          <Shimmer className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Where the offer's own setup of an object lives, linked from its overview. */
function manageLinks(object: CatalogueObject, orgId: string, brandId: string, offerId: string | null) {
  const salesPath = offerId ? v2OfferHref(orgId, brandId, offerId, "sales-path") : v2Href(orgId, brandId, "sales-path");
  const sourcing = offerId ? v2OfferHref(orgId, brandId, offerId, "sourcing") : v2Href(orgId, brandId, "sourcing");
  if (object === "sales-paths" || object === "sales-funnels") return [{ label: "This offer's sales paths", href: salesPath }];
  if (object === "channels") return [{ label: "This offer's channels", href: `${salesPath}#channels` }, { label: "Posts", href: v2Href(orgId, brandId, "posts") }];
  if (object === "pipes") return [{ label: "Sourcing", href: sourcing }];
  return [];
}

/**
 * A business object's OVERVIEW (owner 2026-10-10, staff monitoring): the ones the selected
 * offer's ON campaigns use, then the whole catalogue in the producer's order, searchable.
 */
export function CatalogueOverviewPage({ object }: { object: CatalogueObject }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const router = useRouter();
  const { offerId } = useSelectedOffer();
  const labels = CATALOGUE_OBJECT_LABELS[object];
  const ongoing = useOngoingCatalogue(orgId, brandId, offerId, true);
  const ongoingRows = useMemo(() => (ongoing[object] as Array<Parameters<typeof rowOf>[0]>).map(rowOf), [ongoing, object]);
  const ongoingIds = useMemo(() => new Set(ongoingRows.map((r) => r.id)), [ongoingRows]);

  const [q, setQ] = useState("");
  const list = useStaffCatalogueList(object, { limit: "25", q: q.trim() || undefined });
  const answered = list.data !== undefined || list.isFetchedAfterMount;
  const rows = list.data?.rows ?? [];
  const href = (r: CatalogueRow) => v2CatalogueHref(orgId, brandId, object, r.id);

  const flat = useMemo(() => [...ongoingRows.map((r) => `o:${r.id}`), ...rows.map((r) => `c:${r.id}`)], [ongoingRows, rows]);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useRowKeys({
    count: flat.length,
    cursor,
    setCursor,
    onOpen: (i) => {
      const k = flat[i];
      if (k) router.push(v2CatalogueHref(orgId, brandId, object, k.slice(2)));
    },
    searchRef,
  });
  const cursorKey = cursor >= 0 ? flat[cursor] ?? null : null;
  const links = manageLinks(object, orgId, brandId, offerId);

  return (
    <>
      <TopBar crumbs={[{ label: labels.title }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {ongoing.settled && list.data
                ? `${ongoingRows.length} of ${list.data.total} ${labels.many} ongoing`
                : labels.title}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">{labels.what} Ongoing means a running campaign of this offer uses it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="k-fg2 hover:text-[var(--fg-1)]">
                {l.label} →
              </Link>
            ))}
            {ongoing.settled && (
              <span className="k-fg2 inline-flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${ongoingRows.length ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
                {ongoingRows.length} ongoing now
              </span>
            )}
          </div>
        </div>

        <section className="mt-6">
          <SectionTitle count={ongoing.settled ? ongoingRows.length : null}>Ongoing</SectionTitle>
          {!ongoing.settled && ongoingRows.length === 0 ? (
            <TableSkeleton rows={2} />
          ) : ongoingRows.length === 0 ? (
            <div className="k-card">
              <EmptyNote>No running campaign of this offer uses one.</EmptyNote>
            </div>
          ) : (
            <CatalogueTable
              object={object}
              rows={ongoingRows}
              costUnit={list.data?.costUnit ?? (object === "sales-paths" || object === "sales-funnels" ? "per_paying_client" : "per_outcome")}
              hrefOf={href}
              cursorId={cursorKey?.startsWith("o:") ? cursorKey.slice(2) : null}
            />
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
            All {labels.many}
          </SectionTitle>
          <div className="mb-3">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${labels.many}`}
              aria-label={`Search ${labels.many}`}
              className="k-input w-full max-w-[320px]"
            />
          </div>
          {!answered ? (
            <TableSkeleton />
          ) : list.isError && !list.data ? (
            <div className="k-card">
              <EmptyNote>Could not read the {labels.many}.</EmptyNote>
            </div>
          ) : rows.length === 0 ? (
            <div className="k-card">
              <EmptyNote>No {labels.one} matches.</EmptyNote>
            </div>
          ) : (
            <CatalogueTable
              object={object}
              rows={rows}
              costUnit={list.data?.costUnit ?? "per_outcome"}
              ongoing={ongoingIds}
              hrefOf={href}
              cursorId={cursorKey?.startsWith("c:") ? cursorKey.slice(2) : null}
              footer={
                list.data?.truncated
                  ? `Showing ${rows.length} of ${list.data.total}. Search to find the rest.`
                  : `${rows.length} ${rows.length === 1 ? labels.one : labels.many}`
              }
            />
          )}
        </section>
      </div>
    </>
  );
}

/** Many objects of one kind by id (a page's related objects), in order. */
export function useRelated<K extends CatalogueObject>(object: K, ids: string[]) {
  const gate = useOrgQueryGate();
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: staffCatalogueObjectKey(object, id),
      queryFn: () => getStaffCatalogueObject(object, id),
      staleTime: 60_000,
      retry: false,
      enabled: gate,
    })),
  });
  return {
    rows: results.map((r) => r.data).filter((d): d is NonNullable<typeof d> => d !== undefined).map((d) => rowOf(d as unknown as Parameters<typeof rowOf>[0])),
    settled: results.every((r) => r.data !== undefined || r.isFetchedAfterMount || r.isError),
  };
}

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <dt className="k-label">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{children ?? <span className="k-fg4">—</span>}</dd>
    </div>
  );
}

export function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="k-label">{label}</p>
      <p className="mt-1 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{children}</p>
    </div>
  );
}

function pct(v: number | null | undefined): React.ReactNode {
  if (v == null) return null;
  return `${v > 0 && v < 0.1 ? "<0.1" : v.toFixed(v < 10 ? 1 : 0)}%`;
}

/**
 * ONE business object's page (owner 2026-10-10): its mark and name, the producer's status,
 * its figures, the objects it is made of or used by, and where this offer runs it.
 */
export function CatalogueObjectPage({ object, id }: { object: CatalogueObject; id: string }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId } = useSelectedOffer();
  const labels = CATALOGUE_OBJECT_LABELS[object];
  const q = useStaffCatalogueObject(object, id);
  const ongoing = useOngoingCatalogue(orgId, brandId, offerId, true);
  const isOngoing = (ongoing[object] as Array<{ id: string }>).some((o) => o.id === id);
  const d = q.data as (Parameters<typeof rowOf>[0] & { learningReason: string | null; costUnit: string }) | undefined;
  const row = d ? rowOf(d) : null;
  const href = (o: CatalogueObject) => (r: CatalogueRow) => v2CatalogueHref(orgId, brandId, o, r.id);

  return (
    <>
      <TopBar
        crumbs={[
          { label: labels.title, href: v2CatalogueHref(orgId, brandId, object) },
          {
            label: row ? (
              <span className="inline-flex items-center gap-1.5">
                <CatalogueMark icon={row.icon} color={row.color} face={row.face} name={row.name} size={16} />
                {row.name}
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
        ) : !d || !row ? (
          <div className="k-card">
            <EmptyNote>Could not read this {labels.one}.</EmptyNote>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-4">
              <CatalogueMark icon={row.icon} color={row.color} face={row.face} name={row.name} size={40} />
              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{row.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {isOngoing && <StateDot running label="Ongoing" />}
                  <CatalogueStatus status={row.status} />
                  {typeof d.mode === "string" && <span className="k-chip">{catalogueStatusLabel(d.mode)}</span>}
                  {d.draft === true && <span className="k-chip">Draft</span>}
                </div>
              </div>
            </div>
            <p className="k-fg2 mt-3 text-[14px]">{row.line}</p>

            <div className={`k-card mt-6 grid divide-x divide-[var(--line-subtle)] ${object === "channels" ? "grid-cols-2" : "grid-cols-3"}`}>
              <Kpi label={costUnitLabel(d.costUnit)}>
                <Usd v={row.costUsd} />
              </Kpi>
              <Kpi label="ROI">
                <Roi v={row.roi} />
              </Kpi>
              {object === "steps" && (
                <Kpi label="Value">
                  <Usd v={row.valueUsd} />
                </Kpi>
              )}
              {object === "pipes" && (
                <Kpi label="Conversion">{pct((d as unknown as CataloguePipe).conversionRatePct) ?? <span className="k-fg4">—</span>}</Kpi>
              )}
              {(object === "sales-paths" || object === "sales-funnels") && (
                <Kpi label="Lifetime revenue">
                  <Usd v={d.lifetimeRevenueUsd as number | null} />
                </Kpi>
              )}
            </div>
            {d.learningReason && (
              <p className="k-fg3 mt-2 text-[12px]">
                Learning: <span className="k-mono">{d.learningReason}</span>
              </p>
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-8">
                <ObjectBody object={object} d={d as unknown as Record<string, unknown>} id={id} href={href} ongoing={ongoing} orgId={orgId} brandId={brandId} />
              </div>
              <aside className="k-card h-fit p-4">
                <dl>
                  <ObjectFacts object={object} d={d as unknown as Record<string, unknown>} orgId={orgId} brandId={brandId} />
                  <Fact label="Id">
                    <span className="k-mono k-fg2 break-all text-[12px]">{row.id}</span>
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

type HrefFor = (o: CatalogueObject) => (r: CatalogueRow) => string;

function ObjectLink({ object, id, name, orgId, brandId }: { object: CatalogueObject; id: string; name: string; orgId: string; brandId: string }) {
  return (
    <Link href={v2CatalogueHref(orgId, brandId, object, id)} className="hover:underline">
      {name}
    </Link>
  );
}

/** A link to an object the page knows only by id: its served name once read. */
function NamedLink({ object, id, orgId, brandId }: { object: CatalogueObject; id: string; orgId: string; brandId: string }) {
  const q = useStaffCatalogueObject(object, id);
  const name = (q.data as { name?: string } | undefined)?.name;
  return <ObjectLink object={object} id={id} name={name ?? (q.isError ? id : "…")} orgId={orgId} brandId={brandId} />;
}

function ObjectFacts({ object, d, orgId, brandId }: { object: CatalogueObject; d: Record<string, unknown>; orgId: string; brandId: string }) {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  const yes = (k: string) => (typeof d[k] === "boolean" ? (d[k] ? "Yes" : "No") : null);
  if (object === "steps") {
    const via = d.valueVia as { toStep: string; toStepName: string; ratePct: number } | null;
    return (
      <>
        <Fact label="Description">{s("description")}</Fact>
        <Fact label="Produced by">{s("producedBy")}</Fact>
        <Fact label="Value via">
          {via ? (
            <>
              <ObjectLink object="steps" id={via.toStep} name={via.toStepName} orgId={orgId} brandId={brandId} /> at {pct(via.ratePct)}
            </>
          ) : null}
        </Fact>
        <Fact label="Value basis">{s("valueBasis")}</Fact>
        <Fact label="Sales paths">{typeof d.salesPathCount === "number" ? d.salesPathCount : null}</Fact>
        <Fact label="Declared">{yes("declared")}</Fact>
      </>
    );
  }
  if (object === "sales-paths") {
    return (
      <>
        <Fact label="Best sales funnel">
          {s("bestSalesFunnelId") ? <NamedLink object="sales-funnels" id={s("bestSalesFunnelId") as string} orgId={orgId} brandId={brandId} /> : null}
        </Fact>
        <Fact label="Sales funnels">{typeof d.salesFunnelCount === "number" ? d.salesFunnelCount : null}</Fact>
      </>
    );
  }
  if (object === "channels") {
    return (
      <>
        <Fact label="Description">{s("description")}</Fact>
        <Fact label="Type">{s("channelType") ? catalogueStatusLabel(s("channelType") as string) : null}</Fact>
        <Fact label="Operated by">{s("operatedBy") ? catalogueStatusLabel(s("operatedBy") as string) : null}</Fact>
        <Fact label="Performed by">{s("performedBy") ? catalogueStatusLabel(s("performedBy") as string) : null}</Fact>
        <Fact label="Managed">{yes("managed")}</Fact>
        <Fact label="Best pipe">{s("bestPipeId") ? <NamedLink object="pipes" id={s("bestPipeId") as string} orgId={orgId} brandId={brandId} /> : null}</Fact>
      </>
    );
  }
  if (object === "pipes") {
    return (
      <>
        <Fact label="Channel">
          <ObjectLink object="channels" id={s("channelSlug") as string} name={s("channelName") ?? (s("channelSlug") as string)} orgId={orgId} brandId={brandId} />
        </Fact>
        <Fact label="From">{s("fromStep") ? <NamedLink object="steps" id={s("fromStep") as string} orgId={orgId} brandId={brandId} /> : "Start"}</Fact>
        <Fact label="To">
          <NamedLink object="steps" id={s("toStep") as string} orgId={orgId} brandId={brandId} />
        </Fact>
        <Fact label="Trigger">{s("triggerId") ? <span className="k-mono text-[12px]">{s("triggerId")}</span> : null}</Fact>
        <Fact label="Operated by">{s("operatedBy") ? catalogueStatusLabel(s("operatedBy") as string) : null}</Fact>
        <Fact label="Managed">{yes("managed")}</Fact>
        <Fact label="Value of the step reached">
          <Usd v={d.toStepValueUsd as number | null} />
        </Fact>
        <Fact label="Measured on">{s("measuredBasis") ? catalogueStatusLabel(s("measuredBasis") as string) : null}</Fact>
      </>
    );
  }
  return (
    <>
      <Fact label="Sales path">
        {s("salesPathName") ? (
          <ObjectLink object="sales-paths" id={s("salesPathId") as string} name={s("salesPathName") as string} orgId={orgId} brandId={brandId} />
        ) : (
          <NamedLink object="sales-paths" id={s("salesPathId") as string} orgId={orgId} brandId={brandId} />
        )}
      </Fact>
    </>
  );
}

function ObjectBody({
  object,
  d,
  id,
  href,
  ongoing,
  orgId,
  brandId,
}: {
  object: CatalogueObject;
  d: Record<string, unknown>;
  id: string;
  href: HrefFor;
  ongoing: ReturnType<typeof useOngoingCatalogue>;
  orgId: string;
  brandId: string;
}) {
  const ongoingPipes = useMemo(() => new Set(ongoing.pipes.map((p) => p.id)), [ongoing.pipes]);
  if (object === "steps") return <StepBody ids={(d.producingPipeIds as string[]) ?? []} href={href} ongoing={ongoingPipes} />;
  if (object === "channels") {
    const rows = ((d.pipes as CatalogueRow[]) ?? []).map((r) => r);
    return (
      <section>
        <SectionTitle count={rows.length}>Pipes</SectionTitle>
        {rows.length === 0 ? (
          <div className="k-card">
            <EmptyNote>This channel works no leg yet.</EmptyNote>
          </div>
        ) : (
          <CatalogueTable object="pipes" rows={rows} costUnit="per_outcome" ongoing={ongoingPipes} hrefOf={href("pipes")} />
        )}
      </section>
    );
  }
  if (object === "pipes") return <PipeBody id={id} ongoing={ongoing} orgId={orgId} brandId={brandId} />;
  if (object === "sales-paths") return <PathBody id={id} d={d} href={href} ongoing={ongoing} orgId={orgId} brandId={brandId} />;
  return <FunnelBody d={d} href={href} ongoing={ongoingPipes} />;
}

function StepBody({ ids, href, ongoing }: { ids: string[]; href: HrefFor; ongoing: Set<string> }) {
  const related = useRelated("pipes", ids);
  return (
    <section>
      <SectionTitle count={ids.length}>Pipes that reach it</SectionTitle>
      {ids.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No pipe reaches this step yet.</EmptyNote>
        </div>
      ) : !related.settled && related.rows.length === 0 ? (
        <TableSkeleton rows={Math.min(ids.length, 4)} />
      ) : (
        <CatalogueTable object="pipes" rows={related.rows} costUnit="per_outcome" ongoing={ongoing} hrefOf={href("pipes")} />
      )}
    </section>
  );
}

function PipeBody({ id, ongoing, orgId, brandId }: { id: string; ongoing: ReturnType<typeof useOngoingCatalogue>; orgId: string; brandId: string }) {
  const workflows = useStaffCatalogueList("workflows", { pipe: id, limit: "25" });
  const runs = ongoing.campaignsByPipe.get(id) ?? [];
  const mission = runs[0]?.m.row.campaign.id ?? null;
  const ongoingSlugs = new Set(ongoing.workflows.filter((w) => w.pipeId === id).map((w) => w.slug));
  const rows = workflows.data?.rows ?? [];
  return (
    <>
      <section>
        <SectionTitle count={runs.length}>Running for this offer</SectionTitle>
        {runs.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No running campaign of this offer is this pipe.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            {runs.map((c) => (
              <Link key={c.m.row.campaign.id} href={c.m.href} className="k-row k-line-subtle flex h-10 items-center gap-2.5 border-b px-4 text-[13px] last:border-b-0">
                <OngoingDot />
                <span className="truncate font-medium">{c.name ?? c.m.crew.name}</span>
                <span className="k-fg3 ml-auto truncate text-[12px]">{c.m.offerName}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionTitle count={workflows.data?.total ?? null}>Workflows</SectionTitle>
        {!workflows.data && !workflows.isFetchedAfterMount ? (
          <TableSkeleton />
        ) : workflows.isError && !workflows.data ? (
          <div className="k-card">
            <EmptyNote>Could not read this pipe&apos;s workflows.</EmptyNote>
          </div>
        ) : rows.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No workflow runs this pipe.</EmptyNote>
          </div>
        ) : (
          <CatalogueTable
            object="workflows"
            rows={rows}
            costUnit={workflows.data?.costUnit ?? "per_outcome"}
            ongoing={ongoingSlugs}
            hrefOf={(r) => v2WorkflowHref(orgId, brandId, r.id, id, mission)}
            footer={workflows.data?.truncated ? `The first ${rows.length} of ${workflows.data.total}, in the fleet's rank.` : "In the fleet's rank."}
          />
        )}
      </section>
    </>
  );
}

function PathBody({
  id,
  d,
  href,
  ongoing,
  orgId,
  brandId,
}: {
  id: string;
  d: Record<string, unknown>;
  href: HrefFor;
  ongoing: ReturnType<typeof useOngoingCatalogue>;
  orgId: string;
  brandId: string;
}) {
  const steps = (d.steps as Array<{ id: string; name: string }>) ?? [];
  const funnels = useStaffCatalogueList("sales-funnels", { paths: id, limit: "25" });
  const ongoingFunnels = useMemo(() => new Set(ongoing["sales-funnels"].map((f) => f.id)), [ongoing]);
  const rows = funnels.data?.rows ?? [];
  return (
    <>
      <section>
        <SectionTitle count={steps.length}>Steps</SectionTitle>
        <div className="k-card flex flex-wrap items-center gap-2 px-4 py-3 text-[13px]">
          {steps.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-2">
              {i > 0 && <span className="k-fg4">→</span>}
              <ObjectLink object="steps" id={s.id} name={s.name} orgId={orgId} brandId={brandId} />
            </span>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle count={funnels.data?.total ?? null}>Sales funnels on this path</SectionTitle>
        {!funnels.data && !funnels.isFetchedAfterMount ? (
          <TableSkeleton />
        ) : funnels.isError && !funnels.data ? (
          <div className="k-card">
            <EmptyNote>Could not read the sales funnels of this path.</EmptyNote>
          </div>
        ) : rows.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No sales funnel runs this path yet.</EmptyNote>
          </div>
        ) : (
          <CatalogueTable
            object="sales-funnels"
            rows={rows}
            costUnit={funnels.data?.costUnit ?? "per_paying_client"}
            ongoing={ongoingFunnels}
            hrefOf={href("sales-funnels")}
            footer={funnels.data?.truncated ? `Showing ${rows.length} of ${funnels.data.total}.` : undefined}
          />
        )}
      </section>
    </>
  );
}

function FunnelBody({ d, href, ongoing }: { d: Record<string, unknown>; href: HrefFor; ongoing: Set<string> }) {
  const legs =
    (d.legs as Array<{
      legKey: string;
      ratePct: number | null;
      outcomesNeededPerPayingClient: number | null;
      pipe: { id: string; name: string | null; line: string; costUsd: number | null; roi: number | null; status: string } | null;
    }>) ?? [];
  const toPipe = href("pipes");
  const router = useRouter();
  return (
    <section>
      <SectionTitle count={legs.length}>Legs</SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className={TH}>Pipe</th>
                <th className={`${TH} text-right`}>Rate</th>
                <th className={`${TH} text-right`}>Needed per client</th>
                <th className={`${TH} text-right`}>Cost per outcome</th>
                <th className={`${TH} text-right`}>ROI</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((l) => {
                const p = l.pipe;
                const to = p ? toPipe({ ...p, name: p.name ?? p.id }) : null;
                return (
                  <tr
                    key={l.legKey}
                    onClick={to ? () => router.push(to) : undefined}
                    className={`k-row k-line-subtle border-b last:border-b-0 ${to ? "cursor-pointer" : ""}`}
                  >
                    <td className={TD}>
                      {p ? (
                        <Link href={to as string} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5">
                          <CatalogueMark icon="bird" name={p.name ?? p.id} size={24} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium">{p.name ?? <span className="k-fg4">—</span>}</span>
                              {ongoing.has(p.id) && <OngoingDot />}
                            </span>
                            <span className="k-fg3 block truncate text-[12px]">{p.line}</span>
                          </span>
                        </Link>
                      ) : (
                        <span className="k-fg2">
                          Your team <span className="k-mono k-fg3 text-[12px]">{l.legKey}</span>
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{pct(l.ratePct) ?? <span className="k-fg4">—</span>}</td>
                    <td className={`${TD} text-right tabular-nums`}>{l.outcomesNeededPerPayingClient ?? <span className="k-fg4">—</span>}</td>
                    <td className={`${TD} text-right`}>
                      <Usd v={p?.costUsd} />
                    </td>
                    <td className={`${TD} text-right`}>
                      <Roi v={p?.roi} />
                    </td>
                    <td className={TD}>{p ? <CatalogueStatus status={p.status} /> : <span className="k-fg4">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
