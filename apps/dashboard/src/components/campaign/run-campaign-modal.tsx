"use client";

import { useEffect } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  listExtractedFields,
  flattenFieldValue,
  SALES_PROFILE_FIELDS,
} from "@/lib/api";
import {
  SEED_PERSONAS,
  CATEGORY_META,
  CATEGORY_ORDER,
  type CategoryKey,
} from "@/lib/mock-personas";
import { MaturityBadge } from "@/components/maturity-badge";

/**
 * Run Campaign — UI MOCKUP modal launched from the signups page. Mirrors the
 * campaign-creation page's look, but the objective is LOCKED to Signups (the
 * page is the Signups outcome). The "Campaign settings" block recaps the
 * Customer Persona cards (mock) + the Brand Profile (real `listExtractedFields`
 * read, display-only). Launch is cosmetic — no campaign is created.
 */

const OBJECTIVES: { key: string; label: string; desc: string }[] = [
  { key: "signups", label: "Signups", desc: "Maximize new free signups." },
  { key: "booked_meetings", label: "Booked meetings", desc: "Maximize booked sales meetings." },
  { key: "sales", label: "Sales", desc: "Maximize closed revenue." },
];

// Brand-profile fields surfaced in the recap (the most campaign-relevant subset
// of SALES_PROFILE_FIELDS). Labels come from the canonical field descriptions.
const PROFILE_KEYS = [
  "companyOverview",
  "valueProposition",
  "targetAudience",
  "customerPainPoints",
  "productDifferentiators",
  "competitors",
] as const;
const PROFILE_LABEL: Record<string, string> = Object.fromEntries(
  SALES_PROFILE_FIELDS.map((f) => [f.key, f.description]),
);

export function RunCampaignModal({
  open,
  onClose,
  brandId,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
}) {
  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    { enabled: open },
  );
  const { data: fieldsData } = useAuthQuery(
    ["brandExtractedFields", brandId],
    () => listExtractedFields(brandId),
    { enabled: open },
  );

  if (!open) return null;

  const brandName = brandData?.brand?.name ?? "this brand";
  const fieldMap: Record<string, unknown> = {};
  for (const f of fieldsData?.fields ?? []) fieldMap[f.key] = f.value;
  const profileRows = PROFILE_KEYS.map((k) => ({
    key: k,
    label: PROFILE_LABEL[k] ?? k,
    value: flattenFieldValue(fieldMap[k]),
  })).filter((r) => r.value.trim() !== "");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-gray-900/40 p-4 sm:p-8 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Run Campaign</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Launch a new Signups campaign for {brandName}.
            </p>
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

        <div className="px-6 py-5 space-y-6">
          {/* Objective — locked to Signups */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Objective</h3>
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <LockIcon />
                Locked to Signups
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {OBJECTIVES.map((o) => {
                const active = o.key === "signups";
                return (
                  <div
                    key={o.key}
                    aria-disabled={!active}
                    className={`text-left p-4 rounded-xl border transition ${
                      active
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                        : "border-gray-200 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className={`text-sm font-semibold ${active ? "text-brand-700" : "text-gray-800"}`}>
                      {o.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{o.desc}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Campaign settings — Customer Personas + Brand Profile recap */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Campaign settings</h3>
            <p className="text-xs text-gray-400 mb-3">
              Who we&apos;ll target and what we know about your brand.
            </p>

            {/* Customer Personas */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Personas</h4>
                <MaturityBadge level="beta" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SEED_PERSONAS.map((p) => (
                  <div key={p.id} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CATEGORY_ORDER.flatMap((cat: CategoryKey) =>
                        (p.filters[cat] ?? []).map((v) => (
                          <span
                            key={`${cat}:${v}`}
                            className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${CATEGORY_META[cat].tone}`}
                          >
                            {v}
                          </span>
                        )),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Profile */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand Profile</h4>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {profileRows.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400">
                    No brand profile yet — generate it from Brand Info.
                  </p>
                ) : (
                  profileRows.map((r) => (
                    <div key={r.key} className="grid grid-cols-[8rem_1fr] gap-3 p-3">
                      <span className="text-[11px] font-medium text-gray-400">{r.label}</span>
                      <span className="text-xs text-gray-700 line-clamp-3">{r.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <RocketIcon />
            Launch campaign
          </button>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}
