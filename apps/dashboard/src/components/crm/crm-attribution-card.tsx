"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  ApiError,
  getLeadCrmAttribution,
  setLeadCrmAttribution,
  withdrawLeadCrmAttribution,
} from "@/lib/api";
import {
  attributionLabel,
  crmEvidenceLabel,
  evidencedSteps,
  ruleReasonLabel,
  type CrmAttributionStep,
} from "@/lib/crm-attribution";
import { invalidateLeadOutcome } from "@/lib/write-invalidation";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import { InfoTooltip } from "@/components/visibility/metric-info";

const CARD_TIP =
  "What your own CRM shows for this person, and whether it counts as a result of our outreach. By default it does when it happened after our first email reached them. You can change that for each step.";

/** A refusal in the customer's words, from the STATUS, never the thrown message. */
function writeErrorMessage(err: unknown): string {
  const status = err instanceof ApiError ? err.status : null;
  if (status === 409) return "Your CRM no longer shows this step for this person.";
  if (status === 404) return "We could not find this lead any more.";
  return "We could not save that. Try again.";
}

/**
 * Whose win each meeting and deal the customer's own CRM shows for one lead was.
 *
 * ONE component, two mount points: the lead panel on the Leads pages and the right panel
 * of CRM Merged. Two copies is how the same person would come to be credited one way on
 * one page and the other way one click over.
 *
 * Renders nothing when their CRM evidences nothing for this lead, so a lead with no paired
 * CRM contact reads exactly as it did before.
 */
export function CrmAttributionCard({
  leadRowId,
  brandId,
}: {
  leadRowId: string;
  brandId: string;
}) {
  const queryClient = useQueryClient();
  const key = ["crmAttribution", leadRowId, brandId] as const;
  const q = useAuthQuery([...key], () => getLeadCrmAttribution(leadRowId, brandId));
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = evidencedSteps(q.data);
  if (q.isPending || steps.length === 0) return null;

  const write = async (entry: CrmAttributionStep, next: boolean | "rule") => {
    setPendingStep(entry.step);
    setError(null);
    try {
      if (next === "rule") {
        await withdrawLeadCrmAttribution(leadRowId, entry.step, brandId);
      } else {
        await setLeadCrmAttribution(leadRowId, entry.step, brandId, next);
      }
    } catch (err) {
      console.error("[crm-attribution] write failed", err);
      setError(writeErrorMessage(err));
      setPendingStep(null);
      return;
    }
    // Re-read before releasing the control, so the card never shows the pre-write answer
    // under a finished action. The money reads move too: an outcome's credit decides
    // whether it counts in the return.
    try {
      await queryClient.refetchQueries({ queryKey: [...key] });
    } catch (err) {
      console.error("[crm-attribution] re-read failed", err);
    }
    invalidateLeadOutcome(queryClient);
    queryClient.invalidateQueries({ queryKey: ["crmPairings", brandId] });
    queryClient.invalidateQueries({ queryKey: ["crmPairingCounts", brandId] });
    queryClient.invalidateQueries({ queryKey: ["leadStepStatements", leadRowId] });
    setPendingStep(null);
  };

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3" data-testid="crm-attribution-card">
      <div className="mb-2 flex items-center gap-1">
        <h4 className="text-sm font-semibold text-gray-900">From your CRM</h4>
        <InfoTooltip tip={CARD_TIP} />
      </div>
      <ul className="space-y-3">
        {steps.map((entry) => {
          const busy = pendingStep === entry.step;
          const locked = pendingStep != null;
          const byPerson = entry.basis === "person";
          const when = entry.evidence?.occurredAt ? friendlyDateTime(entry.evidence.occurredAt) : "Date unknown";
          const reason = byPerson ? null : ruleReasonLabel(entry.rule?.reason);
          const answer = entry.causedByOutreach;
          return (
            <li key={entry.step} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-gray-800">{crmEvidenceLabel(entry)}</span>
                <span className="shrink-0 text-xs text-gray-500">{when}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Credited to our outreach:</span>
                <div className="inline-flex overflow-hidden rounded-lg border border-gray-200" role="group">
                  {([true, false] as const).map((v) => {
                    const on = answer === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        disabled={locked || on}
                        aria-pressed={on}
                        onClick={() => write(entry, v)}
                        className={`px-2.5 py-1 text-xs ${
                          on
                            ? v
                              ? "bg-green-50 font-medium text-green-700"
                              : "bg-gray-100 font-medium text-gray-700"
                            : "bg-white text-gray-500 hover:bg-gray-50"
                        } ${locked && !on ? "cursor-wait" : ""}`}
                      >
                        {attributionLabel(v)}
                      </button>
                    );
                  })}
                </div>
                {answer === null ? (
                  <span className="text-xs text-gray-500">{attributionLabel(null)}</span>
                ) : null}
                {busy ? <span className="text-xs text-gray-500">Saving...</span> : null}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {byPerson ? "Set by a person." : reason}
                {byPerson ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => write(entry, "rule")}
                      className="text-brand-600 hover:underline disabled:cursor-wait"
                    >
                      Use the date rule again
                    </button>
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
