"use client";

import { useEffect } from "react";
import { Avatar, OrgLogo, ChannelTags, fmtUsd, fmtDate } from "@/components/revenue/conversions-table";

/** Normalized row detail shown in the slide-over (works for org / lead / persona rows). */
export interface ConversionDetail {
  kind: "org" | "lead";
  title: string;
  /** org name for a lead row; top-person name for an org row. */
  subtitle?: string | null;
  photoUrl?: string | null;
  logoUrl?: string | null;
  orgDomain?: string | null;
  orgName?: string | null;
  persona?: string | null;
  personaDot?: string | null;
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

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          {detail.kind === "org" ? (
            <OrgLogo logoUrl={detail.logoUrl ?? null} domain={detail.orgDomain} name={detail.title} />
          ) : (
            <Avatar photoUrl={detail.photoUrl ?? null} name={detail.title} />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{detail.title}</p>
            {detail.subtitle && <p className="text-xs text-gray-400 truncate">{detail.subtitle}</p>}
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

        {detail.persona && (
          <Row label="Audience">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className={`w-2 h-2 rounded-full ${detail.personaDot ?? "bg-gray-400"}`} />
              {detail.persona}
            </span>
          </Row>
        )}
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
        <Row label="Expected revenue">
          <span className="font-semibold">{fmtUsd(detail.expectedRevenueUsd)}</span>
        </Row>
        <Row label="Latest activity">{fmtDate(detail.date)}</Row>
      </aside>
    </div>
  );
}
