"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getPipeQueue, getPublicCatalogueSteps, type PublicCatalogueStep } from "@/lib/api";
import { personName, teamOutcomes, type PipeQueue, type PipeQueuePerson, type TeamOutcome } from "@/lib/v2/team-work";
import { formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useCampaigns } from "@/components/v2/use-campaigns";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { CompanyMark } from "@/components/v2/people-bits";
import { LeadStatus } from "@/components/v2/today-roi-panel";
import { EmptyNote, Initials, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";

/**
 * Done by your team (FACTORY-P4-PAGES): the work the client's OWN team performs. One card per
 * outcome the team makes for the offer (meetings attended, clients closed...): the people waiting
 * on the team before it, oldest wait first, and what the team moved per week. lead-service serves
 * who waits, since when, and the weekly counts; the catalogue serves the outcomes and who performs
 * the work. No outcome is named (owner 2026-11-02). A person opens the SAME "Update this lead" control as Today
 * (Happened / Mark as won / Won't happen), never a new one.
 */

const TICK = { fontSize: 11, fill: "var(--fg-3)" };

export function V2TeamWork() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { allCampaigns, settled } = useCampaigns(orgId, brandId);
  const channels = useAcquisitionChannels();
  const steps = useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, { staleTime: 10 * 60_000 });
  const { offerId } = useSelectedOffer();
  const outcomes = useMemo(
    () =>
      teamOutcomes(
        allCampaigns.map((c) => ({
          running: c.running,
          operatedBy: acquisitionChannelForFeatureSlug(c.row.campaign.featureSlug, channels)?.operatedBy ?? null,
          fromKey: c.leg?.fromKey ?? null,
          fromLabel: c.leg?.fromLabel ?? null,
          toKey: c.leg?.toKey ?? "",
          toLabel: c.leg?.toLabel ?? "",
        })),
      ),
    [allCampaigns, channels],
  );
  return <TeamWorkBody brandId={brandId} outcomes={outcomes} settled={settled} offerPicked={offerId !== null} steps={steps.data} />;
}

/** The page under its hooks: the outcomes the team makes, each with its people and weekly moves. */
export function TeamWorkBody({
  brandId,
  outcomes,
  settled,
  offerPicked,
  steps,
}: {
  brandId: string;
  outcomes: TeamOutcome[];
  settled: boolean;
  offerPicked: boolean;
  steps: PublicCatalogueStep[] | undefined;
}) {
  const [open, setOpen] = useState<{ person: PipeQueuePerson; outcome: TeamOutcome } | null>(null);
  return (
    <>
      <TopBar crumbs={[{ label: "Done by your team" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {settled ? (
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
            {outcomes.length === 0 ? "Your team makes no outcome yet" : `Your team makes ${outcomes.length} ${outcomes.length === 1 ? "outcome" : "outcomes"}`}
          </h1>
        ) : (
          <Shimmer className="h-[34px] w-72" />
        )}
        <p className="k-fg2 mt-1 text-[14px]">Who waits on your team before each outcome, and how many your team moved each week.</p>

        {!settled ? (
          <div className="mt-6 space-y-3">
            <Shimmer className="h-[320px] w-full rounded-[12px]" />
          </div>
        ) : outcomes.length === 0 ? (
          <div className="k-card mt-6">
            <EmptyNote>{offerPicked ? "No running campaign of this offer is worked by the client's own team." : "Pick an offer to see its team's work."}</EmptyNote>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {outcomes.map((p) => (
              <OutcomeCard key={`${p.fromKey}>${p.toKey}`} brandId={brandId} outcome={p} steps={steps} onOpen={(person) => setOpen({ person, outcome: p })} />
            ))}
          </div>
        )}
      </div>
      {open && <PersonDrawer person={open.person} outcome={open.outcome} steps={steps} onClose={() => setOpen(null)} />}
    </>
  );
}

function StepLabel({ stepKey, fallback, steps }: { stepKey: string; fallback: string; steps: PublicCatalogueStep[] | undefined }) {
  const step = steps?.find((s) => s.key === stepKey);
  return (
    <span className="inline-flex items-center gap-1.5">
      <CatalogueMark icon={step?.icon ?? null} name={step?.name ?? fallback} size={16} />
      <span>{step?.name ?? fallback}</span>
    </span>
  );
}

function OutcomeCard({ brandId, outcome, steps, onOpen }: { brandId: string; outcome: TeamOutcome; steps: PublicCatalogueStep[] | undefined; onOpen: (p: PipeQueuePerson) => void }) {
  const q = useAuthQuery(["pipeQueue", brandId, outcome.fromKey, outcome.toKey], () => getPipeQueue(brandId, outcome.fromKey, outcome.toKey), { ...pollOptions, retry: false });
  const data = q.data;
  const fromName = steps?.find((s) => s.key === outcome.fromKey)?.name ?? outcome.fromLabel;
  const toName = steps?.find((s) => s.key === outcome.toKey)?.name ?? outcome.toLabel;
  return (
    <section className="k-card overflow-hidden">
      <div className="k-line-subtle flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <CatalogueMark icon={steps?.find((s) => s.key === outcome.toKey)?.icon ?? null} name={toName} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{toName}</p>
            <p className="k-fg2 mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span>From</span>
              <StepLabel stepKey={outcome.fromKey} fallback={outcome.fromLabel} steps={steps} />
            </p>
          </div>
        </div>
        <div className="text-right">
          {data ? (
            <p className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">
              {data.unservedReason ? <span className="k-fg4">—</span> : formatCount(data.waitingCount)}
            </p>
          ) : (
            <Shimmer className="ml-auto h-7 w-10" />
          )}
          <p className="k-fg3 text-[12px]">{data?.waitingCount === 1 ? "person waiting" : "people waiting"}</p>
        </div>
      </div>
      {data === undefined ? (
        q.isFetchedAfterMount && q.isError ? (
          <EmptyNote>Could not read who waits on your team here. Retrying.</EmptyNote>
        ) : (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Shimmer key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : data.unservedReason ? (
        <EmptyNote>
          {data.unservedReason === "from_step_has_no_state"
            ? `Nobody can be listed here yet: we do not track who reached ${fromName}.`
            : `Nobody can be listed here yet: we do not track who reached ${toName}.`}
        </EmptyNote>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <Waiting data={data} onOpen={onOpen} />
          <Throughput data={data} fromName={fromName} toName={toName} />
        </div>
      )}
    </section>
  );
}

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";

const FIRST_ROWS = 8;

function Waiting({ data, onOpen }: { data: PipeQueue; onOpen: (p: PipeQueuePerson) => void }) {
  const [all, setAll] = useState(false);
  if (data.waiting.length === 0) {
    return <EmptyNote>Nobody waits on your team here.</EmptyNote>;
  }
  return (
    <div className="min-w-0">
      <table className="w-full table-fixed text-[13px]">
        <colgroup>
          <col />
          <col className="w-[132px]" />
        </colgroup>
        <thead>
          <tr className="k-line-subtle border-b">
            <th className={TH}>Person</th>
            <th className={TH}>Waiting since</th>
          </tr>
        </thead>
        <tbody>
          {(all ? data.waiting : data.waiting.slice(0, FIRST_ROWS)).map((p) => (
            <tr key={p.leadId} className="k-row k-line-subtle cursor-pointer border-b last:border-b-0" onClick={() => onOpen(p)}>
              <td className="px-3 py-2 first:pl-4">
                <button type="button" className="flex min-w-0 items-center gap-2.5 text-left" onClick={(e) => { e.stopPropagation(); onOpen(p); }}>
                  <PersonMark person={p} />
                  <span className="min-w-0">
                    <span className="block truncate">{personName(p)}</span>
                    <span className="k-fg3 block truncate text-[12px]">{[p.title, p.orgName].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                </button>
              </td>
              <td className="k-mono k-fg2 px-3 py-2 text-[12px] last:pr-4" title={p.waitingSince ? new Date(p.waitingSince).toLocaleString("en-US") : undefined}>
                {p.waitingSince ? timeAgo(p.waitingSince) : <span className="k-fg4">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(data.waiting.length > FIRST_ROWS || data.waitingCount > data.waiting.length) && (
        <div className="k-fg3 k-line-subtle flex items-center justify-between border-t px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {data.waitingCount > data.waiting.length
              ? `The ${formatCount(data.waiting.length)} who waited longest, of ${formatCount(data.waitingCount)}`
              : `Longest wait first`}
          </span>
          {data.waiting.length > FIRST_ROWS && (
            <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setAll((v) => !v)}>
              {all ? "Show less" : `Show ${formatCount(data.waiting.length - FIRST_ROWS)} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A person's mark, as tall as their two lines: their company's logo, else their initials. */
function PersonMark({ person }: { person: PipeQueuePerson }) {
  if (person.orgDomain) return <CompanyMark name={person.orgName ?? personName(person)} domain={person.orgDomain} size={32} />;
  return <Initials name={personName(person)} size={32} />;
}

function weekText(w: string): string {
  return new Date(`${w}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** What the team moved per week: lead-service's served weekly counts, as bars. */
function Throughput({ data, fromName, toName }: { data: PipeQueue; fromName: string; toName: string }) {
  return (
    <div className="k-line-subtle flex min-w-0 flex-col border-t p-4 lg:border-l lg:border-t-0">
      <p className="k-label">Moved per week</p>
      <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">
        People your team took from {fromName} to {toName}, by the week they got there.
      </p>
      <div className="mt-3 h-[160px]">
        {data.throughput.length === 0 ? (
          <EmptyNote>Nobody moved yet.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.throughput} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
              <XAxis dataKey="week" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={weekText} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={28} tickCount={4} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--data-track)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as PipeQueue["throughput"][number];
                  return (
                    <div className="k-popover px-2.5 py-1.5 text-[12px]">
                      <p className="k-fg3 k-mono">Week of {weekText(r.week)}</p>
                      <p className="font-medium tabular-nums">
                        {formatCount(r.moved)} {r.moved === 1 ? "person" : "people"}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="moved" fill="var(--data-teal)" isAnimationActive={false} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** One waiting person, right panel: who, since when, and the shared "Update this lead" control. */
function PersonDrawer({ person, outcome, steps, onClose }: { person: PipeQueuePerson; outcome: TeamOutcome; steps: PublicCatalogueStep[] | undefined; onClose: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!host) return null;
  const fromName = steps?.find((s) => s.key === outcome.fromKey)?.name ?? outcome.fromLabel;
  return createPortal(
    <aside
      role="dialog"
      aria-label={`${personName(person)} details`}
      className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(440px,calc(100vw-16px))] flex-col overflow-hidden"
      style={{ boxShadow: "var(--elev-popover)" }}
    >
      <div className="k-line-subtle flex items-center justify-between border-b px-4 py-2.5">
        <span className="k-label">Waiting on your team</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          ×
        </button>
      </div>
      <div className="k-scroll flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <PersonMark person={person} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium">{personName(person)}</p>
            <p className="k-fg3 truncate text-[12px]">{[person.title, person.orgName].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        </div>
        <p className="k-fg2 text-[13px]">
          {person.waitingSince ? `${fromName} ${timeAgo(person.waitingSince).toLowerCase()}.` : `${fromName}, date unknown.`}
        </p>
        <LeadStatus lead={{ campaignLeadId: person.campaignLeadId, step: { key: outcome.fromKey } }} lifetimeRevenueUsd={null} />
      </div>
    </aside>,
    host,
  );
}
