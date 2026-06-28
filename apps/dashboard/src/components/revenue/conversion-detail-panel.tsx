"use client";

import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Avatar, OrgLogo, ChannelTags, fmtDate } from "@/components/revenue/conversions-table";
import { Skeleton } from "@/components/skeleton";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandLeads,
  listAudiences,
  getAudienceMembershipStats,
  type AudienceWire,
} from "@/lib/api";

/** Normalized row detail shown in the slide-over (works for org / lead rows). */
export interface ConversionDetail {
  kind: "org" | "lead";
  /** lead-service lead id — lets the lead panel fetch the full profile + audience. */
  leadId?: string | null;
  title: string;
  /** org name for a lead row; top-person name for an org row. */
  subtitle?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  orgDomain?: string | null;
  orgName?: string | null;
  tags: string[];
  expectedRevenueUsd: number;
  date: string | null;
  probabilityPct?: number | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3 border-b border-gray-100">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="mt-1 text-sm text-gray-800">{children}</div>
    </div>
  );
}

// Pull a string[] off the free-form audience filters blob (titles / seniorities /
// industries). The filter shape is human-service's PeopleSearchFilters; we only
// read the few human-readable arrays for the "why relevant" chips.
function filterList(filters: Record<string, unknown> | null | undefined, key: string): string[] {
  const v = filters?.[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * Why-this-lead section — sources audience targeting from human-service (the
 * owner). `listBrandLeads` (lead-service, cached) gives the clicked lead's email
 * + job title / industry; `getAudienceMembershipStats` maps the email → audience
 * ids; `listAudiences` (already loaded on the overview) supplies each audience's
 * name / description / avatar / filters. No fabrication: when a lead has no
 * matched audience the section is omitted (returns null), profile fields render
 * whatever is present.
 */
function LeadWhyRelevant({ leadId, fallbackName }: {
  leadId: string;
  fallbackName: string;
}) {
  const params = useParams();
  const brandId = (params?.brandId as string | undefined) ?? undefined;

  // Lead profile (job title / industry / email) — reuses the leads page's cache
  // key so this is usually a warm read; gated on the panel being open.
  const { data: leadsData, isPending: leadsPending } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId!),
    { enabled: !!brandId },
  );
  const leadRow = useMemo(
    () => leadsData?.leads.find((l) => l.leadId === leadId) ?? null,
    [leadsData, leadId],
  );
  const profile = leadRow?.lead ?? null;
  const email = leadRow?.email ?? null;

  // Audience membership for this lead's email (human-service).
  const { data: statsData, isPending: statsPending } = useAuthQuery(
    ["audienceStats", email],
    () => getAudienceMembershipStats({ emails: [email!] }),
    { enabled: !!email },
  );
  const { data: audiencesData } = useAuthQuery(
    ["audiences", brandId],
    () => listAudiences(brandId!),
    { enabled: !!brandId },
  );

  const matched: AudienceWire[] = useMemo(() => {
    const ids = new Set(statsData?.matched[0]?.audiences.map((a) => a.audienceId) ?? []);
    if (ids.size === 0) return [];
    return (audiencesData?.audiences ?? []).filter((a) => ids.has(a.id));
  }, [statsData, audiencesData]);

  const jobTitle = profile?.currentTitle ?? null;
  const industry = profile?.organization?.industry ?? null;
  const location = [profile?.city, profile?.country].filter(Boolean).join(", ") || null;

  // Audience lookup still resolving — hold a light skeleton (don't flash "no match").
  const audienceResolving = (!!email && statsPending) || (!!brandId && leadsPending);

  return (
    <>
      {(jobTitle || industry || location) && (
        <Row label="About">
          <div className="space-y-1">
            {jobTitle && <p className="font-medium text-gray-900">{jobTitle}</p>}
            {industry && <p className="text-gray-600">{industry}</p>}
            {location && <p className="text-gray-500 text-xs">{location}</p>}
          </div>
        </Row>
      )}

      {audienceResolving ? (
        <div className="px-5 py-4 border-b border-gray-100 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : matched.length > 0 ? (
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Why we picked this lead</p>
          <div className="space-y-4">
            {matched.map((aud) => {
              const titles = filterList(aud.filters, "titles");
              const seniorities = filterList(aud.filters, "seniorities");
              const industries = filterList(aud.filters, "industries");
              const reasons = [...titles, ...seniorities, ...industries];
              return (
                <div key={aud.id} className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    {aud.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={aud.avatarUrl}
                        alt={aud.name}
                        className="w-14 h-14 rounded-lg object-cover bg-white border border-gray-200 shrink-0"
                      />
                    ) : (
                      <span className="w-14 h-14 rounded-lg bg-brand-100 text-brand-700 text-lg font-semibold flex items-center justify-center shrink-0">
                        {aud.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-brand-600 uppercase tracking-wide">Audience</p>
                      <p className="font-semibold text-gray-900 truncate">{aud.name}</p>
                    </div>
                  </div>
                  {aud.description && (
                    <p className="px-3 pb-3 text-sm text-gray-600 leading-relaxed">{aud.description}</p>
                  )}
                  {reasons.length > 0 && (
                    <div className="px-3 pb-3">
                      <Chips items={reasons} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* No profile and no matched audience — keep the panel reassuring rather
          than empty (the header already shows the face + company). */}
      {!jobTitle && !industry && !location && matched.length === 0 && !audienceResolving && (
        <div className="px-5 py-4 text-sm text-gray-500">
          {fallbackName ? `${fallbackName} is in your pipeline.` : "This lead is in your pipeline."}
        </div>
      )}
    </>
  );
}

export function ConversionDetailPanel({
  detail,
  onClose,
}: {
  detail: ConversionDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, onClose]);

  if (!detail) return null;

  const isLead = detail.kind === "lead";

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
        {/* Header — image-forward: a large face (lead) or company mark (org). */}
        <div className="flex items-start gap-4 px-5 py-5 border-b border-gray-100">
          {detail.kind === "org" ? (
            <OrgLogo logoUrl={detail.logoUrl ?? null} domain={detail.orgDomain} name={detail.title} />
          ) : (
            <div className="shrink-0 scale-[1.6] origin-top-left ml-1 mt-1">
              <Avatar photoUrl={detail.photoUrl ?? null} name={detail.title} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-lg leading-tight truncate">{detail.title}</p>
            {detail.kind === "lead" && detail.orgName && (
              <span className="mt-1.5 inline-flex items-center gap-2 text-sm text-gray-600">
                <OrgLogo logoUrl={detail.logoUrl ?? null} domain={detail.orgDomain} name={detail.orgName} />
                <span className="truncate">{detail.orgName}</span>
              </span>
            )}
            {detail.kind === "org" && detail.subtitle && (
              <p className="text-xs text-gray-400 truncate">{detail.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLead && detail.leadId ? (
          <LeadWhyRelevant leadId={detail.leadId} fallbackName={detail.title} />
        ) : (
          <>
            {detail.kind === "lead" && detail.orgName && (
              <Row label="Company">
                <span className="inline-flex items-center gap-2">
                  <OrgLogo logoUrl={detail.logoUrl ?? null} domain={detail.orgDomain} name={detail.orgName} />
                  {detail.orgName}
                </span>
              </Row>
            )}
            <Row label="Conversions">
              <ChannelTags tags={detail.tags} />
            </Row>
            {detail.probabilityPct != null && (
              <Row label="Signup probability">{Math.round(detail.probabilityPct)}%</Row>
            )}
            <Row label="Latest activity">{fmtDate(detail.date)}</Row>
          </>
        )}
      </aside>
    </div>
  );
}
