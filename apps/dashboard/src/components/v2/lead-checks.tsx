"use client";

import { getLeadQualification, type LeadCheck } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ROLE_LABEL, VERDICT_LABEL } from "@/lib/v2/qualification";
import { SectionTitle, Shimmer } from "@/components/v2/ui";

const VERDICT_DOT: Record<LeadCheck["verdict"], string> = {
  yes: "bg-[var(--run)]",
  no: "bg-[var(--fg-3)]",
  unavailable: "bg-[var(--data-amber)]",
  not_checked: "border-[1.5px] border-[var(--fg-3)]",
};

/**
 * A person's Checks (owner 2026-10-07): what each ENABLED check of the offer says about their
 * company, the proof in plain words, and the screenshot when the check took one (the first
 * email cites the words, follow-ups can show the picture). Nothing when the offer has no check.
 */
export function LeadChecks({ leadId, brandId, offerId }: { leadId: string; brandId: string; offerId: string | null }) {
  const q = useAuthQuery(["leadQualification", leadId, brandId, offerId], () => getLeadQualification(leadId, brandId, offerId));

  if (!q.data) {
    if (q.isError && q.isFetchedAfterMount) {
      return (
        <div className="k-card p-4">
          <p className="k-fg3 text-[13px]">We could not read this company&apos;s checks right now.</p>
        </div>
      );
    }
    return <Shimmer className="h-16 w-full rounded-xl" />;
  }
  if (q.data.checks.length === 0) return null;

  return (
    <section>
      <SectionTitle count={q.data.checks.length}>Checks</SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        {q.data.checks.map((c) => (
          <CheckRow key={c.criterionId} check={c} />
        ))}
      </div>
    </section>
  );
}

function CheckRow({ check: c }: { check: LeadCheck }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 text-[13px] font-medium">{c.question}</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
            <span className={`h-2 w-2 rounded-full ${VERDICT_DOT[c.verdict]}`} />
            {VERDICT_LABEL[c.verdict]}
          </span>
        </div>
        {c.evidence ? (
          <p className="k-fg2 mt-1 text-[13px]">{c.evidence}</p>
        ) : c.verdict === "not_checked" ? (
          <p className="k-fg3 mt-1 text-[12px]">We check this company before we write to it.</p>
        ) : null}
        <p className="k-fg3 mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="k-chip">{ROLE_LABEL[c.mode]}</span>
          <span>{c.source}</span>
        </p>
      </div>
      {c.screenshotUrl && (
        <a
          href={c.screenshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="k-inset block w-full shrink-0 overflow-hidden rounded-[8px] sm:w-[180px]"
          aria-label="Open the screenshot"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.screenshotUrl} alt="" loading="lazy" className="block h-[120px] w-full object-cover object-top" />
        </a>
      )}
    </div>
  );
}
