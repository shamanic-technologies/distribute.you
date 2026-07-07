"use client";

import { type EmailSequenceStep } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";
import { EmailSignature } from "@/components/email-signature";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

// One email card in a workflow preview — used for both this-session test runs and
// pre-filled past examples. Click toggles the full multi-step sequence. A `scope` other
// than "brand" renders a small source tag (the example came from another brand / org).
// Shared by the New Campaign picker and the Workflows table Edit panel so the two stay
// byte-identical in format.
export interface ExampleEmailCardData {
  id: string;
  subject: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadCompany: string | null;
  generationRun?: { status: string } | null;
  scope?: "brand" | "org" | "global";
  brandName?: string | null;
}

export function ExampleEmailCard({ email, expanded, onToggle }: { email: ExampleEmailCardData; expanded: boolean; onToggle: () => void }) {
  const firstBody = email.sequence?.[0]?.bodyText ?? email.bodyText;
  // Full email = the whole sequence (initial + follow-ups); fall back to a single synthetic step.
  const steps = email.sequence && email.sequence.length > 0
    ? email.sequence
    : (firstBody ? [{ step: 1, bodyText: firstBody, bodyHtml: "", daysSinceLastStep: 0 }] : []);
  const otherSource = email.scope === "org" || email.scope === "global";
  const sourceLabel = email.brandName || (email.scope === "org" ? "another brand" : "another workspace");
  return (
    <button type="button" onClick={onToggle}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-800 truncate">{[email.leadFirstName, email.leadLastName].filter(Boolean).join(" ") || "Lead"}{email.leadCompany ? ` · ${email.leadCompany}` : ""}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {otherSource && (
            <span title="Example from another brand / organization, shown so you can preview this workflow"
              className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Example · {sourceLabel}
            </span>
          )}
          {email.generationRun?.status && <span className="text-[10px] text-gray-400">{email.generationRun.status}</span>}
          {steps.length > 0 && <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />}
        </span>
      </div>
      {email.subject && <div className="text-xs font-semibold text-gray-700 mt-1 truncate">{email.subject}</div>}
      {!expanded && firstBody && <div className="text-[11px] text-gray-500 mt-1 line-clamp-3 whitespace-pre-wrap">{firstBody}</div>}
      {expanded && (
        <div className="mt-2 space-y-2">
          {steps.map((s) => (
            <div key={s.step} className="border-t border-gray-100 pt-2">
              {steps.length > 1 && (
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {s.step === 1
                    ? "Initial email"
                    : `Follow-up ${s.step - 1}${s.daysSinceLastStep ? ` · ${s.daysSinceLastStep} day${s.daysSinceLastStep === 1 ? "" : "s"} later` : ""}`}
                </div>
              )}
              <div className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{s.bodyText}</div>
              {s.bodyText && <EmailSignature className="text-[11px] text-gray-500" />}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// Placeholder card shown while a workflow's examples fetch — mirrors the collapsed
// ExampleEmailCard layout (lead row + subject + 3 body lines) for zero layout shift.
export function ExampleEmailSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-3.5 shrink-0" />
      </div>
      <Skeleton className="h-3 w-32 mt-1.5" />
      <Skeleton className="h-2.5 w-full mt-1.5" />
      <Skeleton className="h-2.5 w-5/6 mt-1" />
      <Skeleton className="h-2.5 w-2/3 mt-1" />
    </div>
  );
}
