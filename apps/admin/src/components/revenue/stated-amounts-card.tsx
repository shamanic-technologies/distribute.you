"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  ApiError,
  getAuditAccounts,
  listStatedAmounts,
  createStatedAmount,
  updateStatedAmount,
  deleteStatedAmount,
  type AuditAccounts,
  type AuditAccountRow,
  type StatedAmount,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { formatUsd } from "@/lib/format-number";
import {
  EMPTY_STATED_AMOUNT_DRAFT,
  statedAmountBody,
  statedAmountDraftProblem,
  statedAmountErrorMessage,
  termLabel,
  isInForceToday,
  type StatedAmountDraft,
} from "@/lib/stated-amount-write";

/**
 * WHERE THE AGENCY HALF OF MRR COMES FROM — the one place a human states what a
 * brand is worth per month.
 *
 * A self-serve customer pays through the product, so their run-rate IS their
 * daily budget × 30 and nobody has to say anything. An agency hands over cash at
 * its own discretion and somebody then decides how that cash is spread into
 * daily budgets across its brands — so for those brands the budget answers "how
 * did we split their money", never "what are they worth". This card is where
 * that second question gets an answer.
 *
 * Stating an amount for a brand does TWO things at once, and the copy says so:
 * it puts that amount in the agency half, and it takes that brand's ORG out of
 * the self-serve half. Which orgs count as agency is derived from these rows by
 * features-service — there is no list of agencies anywhere, and adding a second
 * one needs no code.
 *
 * Every rule about what may be written lives at the producer: a malformed range
 * and an OVERLAPPING range are both refused there, the second with a sentence
 * naming the row it collided with. That sentence is rendered verbatim — two
 * amounts in force on one day is two answers to one question, and the person
 * needs to know which row is in the way.
 */

/** Today as a UTC calendar day — the basis every bound in this store is written in. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function brandLabel(row: AuditAccountRow): string {
  return row.brandName ?? row.brandDomain ?? row.brandId.slice(0, 8);
}

/** A stable option label: the brand, its domain, and what it is running today. */
function optionLabel(row: AuditAccountRow): string {
  const name = brandLabel(row);
  const domain = row.brandDomain && row.brandDomain !== name ? ` · ${row.brandDomain}` : "";
  const budget =
    row.runningDailyBudgetUsd > 0
      ? ` · ${formatUsd(row.runningDailyBudgetUsd, 0)}/day running`
      : row.configuredDailyBudgetUsd > 0
        ? ` · ${formatUsd(row.configuredDailyBudgetUsd, 0)}/day posted, nothing running`
        : " · nothing funded";
  return `${name}${domain}${budget}`;
}

/** `orgId::brandId` — budgets and stated amounts are both keyed on the PAIR, never the brand alone. */
function pairKey(orgId: string, brandId: string): string {
  return `${orgId}::${brandId}`;
}

export function StatedAmountsCard() {
  const queryClient = useQueryClient();
  const today = utcToday();

  const {
    data: stated,
    isPending: statedPending,
    isError: statedError,
    error: statedErr,
  } = useAuthQuery<StatedAmount[]>(["statedAmounts"], () => listStatedAmounts(), pollOptionsSlower);

  // The brand universe is the accounts audit — the same key that page already
  // polls, so offering a picker here costs no extra request.
  const { data: accounts } = useAuthQuery<AuditAccounts>(
    ["auditAccounts"],
    () => getAuditAccounts(),
    pollOptionsSlower,
  );

  const [draft, setDraft] = useState<StatedAmountDraft>(EMPTY_STATED_AMOUNT_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const rowsByPair = useMemo(() => {
    const map = new Map<string, AuditAccountRow>();
    for (const row of accounts?.rows ?? []) map.set(pairKey(row.orgId, row.brandId), row);
    return map;
  }, [accounts]);

  // Funded first (that is what moves a number), then by name, so the brands worth
  // stating an amount for are the ones at the top of the picker.
  const pickable = useMemo(() => {
    return [...(accounts?.rows ?? [])].sort((a, b) => {
      if (a.runningDailyBudgetUsd !== b.runningDailyBudgetUsd) {
        return b.runningDailyBudgetUsd - a.runningDailyBudgetUsd;
      }
      if (a.configuredDailyBudgetUsd !== b.configuredDailyBudgetUsd) {
        return b.configuredDailyBudgetUsd - a.configuredDailyBudgetUsd;
      }
      return brandLabel(a).localeCompare(brandLabel(b));
    });
  }, [accounts]);

  // In force today first — those are the rows the live cards are reading — then
  // the rest newest-term first.
  const sorted = useMemo(() => {
    return [...(stated ?? [])].sort((a, b) => {
      const aLive = isInForceToday(a.startDate, a.endDate, today);
      const bLive = isInForceToday(b.startDate, b.endDate, today);
      if (aLive !== bLive) return aLive ? -1 : 1;
      return (b.startDate ?? "").localeCompare(a.startDate ?? "");
    });
  }, [stated, today]);

  /** Every write re-reads the split: stating an amount MOVES both halves. */
  function afterWrite() {
    queryClient.invalidateQueries({ queryKey: ["statedAmounts"] });
    queryClient.invalidateQueries({ queryKey: ["fleetRevenue"] });
    setDraft(EMPTY_STATED_AMOUNT_DRAFT);
    setEditingId(null);
    setRefusal(null);
  }

  function onRefused(err: unknown) {
    const status = err instanceof ApiError ? err.status : null;
    const body = err instanceof ApiError ? err.body : null;
    setRefusal(statedAmountErrorMessage(status, body));
  }

  const save = useMutation({
    mutationFn: async (d: StatedAmountDraft) => {
      const body = statedAmountBody(d);
      if (editingId) {
        // An omitted key would KEEP the stored bound, so every field is sent —
        // clearing a date has to reach the producer as an explicit null to mean
        // "open this end".
        return updateStatedAmount(editingId, {
          amountUsd: body.amountUsd,
          startDate: body.startDate,
          endDate: body.endDate,
          note: body.note,
        });
      }
      return createStatedAmount(body);
    },
    onSuccess: afterWrite,
    onError: onRefused,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteStatedAmount(id),
    onSuccess: afterWrite,
    onError: onRefused,
  });

  const problem = statedAmountDraftProblem(draft);
  const busy = save.isPending || remove.isPending;

  function startEdit(row: StatedAmount) {
    setEditingId(row.id);
    setRefusal(null);
    setDraft({
      orgId: row.orgId,
      brandId: row.brandId,
      amount: String(row.amountUsd),
      startDate: row.startDate ?? "",
      endDate: row.endDate ?? "",
      note: row.note ?? "",
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">What the agency&apos;s brands are worth</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        An agency hands over cash at its own discretion and somebody then decides how it is spread into
        daily budgets, so budget × 30 says how the money was split, not what the customer is worth. Say
        it here instead. Stating an amount for a brand puts it in the agency half and takes its whole org
        out of the self-serve half — which orgs are agency is read from these rows, nothing is hardcoded.
      </p>

      {statedError && (
        <p className="mt-4 text-sm text-red-700">
          Could not read the stated amounts: {statedErr?.message ?? "unknown error"}
        </p>
      )}

      {/* ── The rows already stated ─────────────────────────────────────── */}
      <div className="mt-5">
        {statedPending && !stated ? (
          <Skeleton className="h-24 w-full rounded" />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing stated yet, so every org is self-serve and the agency half is $0.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Brand</th>
                  <th className="pb-2 pr-4 font-medium">Per month</th>
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 pr-4 font-medium">Note</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const account = rowsByPair.get(pairKey(row.orgId, row.brandId));
                  const live = isInForceToday(row.startDate, row.endDate, today);
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-gray-800">
                          {account ? brandLabel(account) : row.brandId.slice(0, 8)}
                        </span>
                        {account?.brandDomain && (
                          <span className="ml-2 text-xs text-gray-500">{account.brandDomain}</span>
                        )}
                        {!live && (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            not in force today
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-medium text-gray-800">{formatUsd(row.amountUsd, 0)}</td>
                      <td className="py-3 pr-4 text-gray-500">{termLabel(row.startDate, row.endDate)}</td>
                      <td className="py-3 pr-4 text-gray-500">{row.note ?? "—"}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={busy}
                          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove.mutate(row.id)}
                          disabled={busy}
                          className="ml-2 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── State one ───────────────────────────────────────────────────── */}
      <div className="mt-6 border-t border-gray-200 pt-5">
        <h3 className="text-sm font-semibold text-gray-800">
          {editingId ? "Edit this stated amount" : "State an amount"}
        </h3>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="text-gray-700">Brand</span>
            <select
              value={draft.brandId ? pairKey(draft.orgId, draft.brandId) : ""}
              disabled={editingId !== null}
              onChange={(e) => {
                const [orgId, brandId] = e.target.value.split("::");
                setDraft((d) => ({ ...d, orgId: orgId ?? "", brandId: brandId ?? "" }));
              }}
              className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:ring-brand-300 disabled:opacity-50"
            >
              <option value="">Pick a brand…</option>
              {pickable.map((row) => (
                <option key={pairKey(row.orgId, row.brandId)} value={pairKey(row.orgId, row.brandId)}>
                  {optionLabel(row)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-gray-700">Worth per month (USD)</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              placeholder="4000"
              className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:ring-brand-300"
            />
          </label>

          <label className="text-sm">
            <span className="text-gray-700">From</span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:ring-brand-300"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Leave empty for “since this brand’s first day of spend”.
            </span>
          </label>

          <label className="text-sm">
            <span className="text-gray-700">Until</span>
            <input
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:ring-brand-300"
            />
            <span className="mt-1 block text-xs text-gray-500">Leave empty for “still running”.</span>
          </label>

          <label className="text-sm md:col-span-2">
            <span className="text-gray-700">Note (optional)</span>
            <input
              type="text"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder="Why this amount — the cash is discretionary, so it is worth saying."
              className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:ring-brand-300"
            />
          </label>
        </div>

        {/* The refusal is the PRODUCER's sentence — on an overlap it names the row
            in the way, which is the only thing that tells the person what to fix. */}
        {refusal && <p className="mt-3 text-sm text-red-700">{refusal}</p>}
        {!refusal && problem && draft.brandId !== "" && (
          <p className="mt-3 text-sm text-gray-500">{problem}</p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_STATED_AMOUNT_DRAFT);
                setRefusal(null);
              }}
              disabled={busy}
              className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => save.mutate(draft)}
            disabled={busy || problem !== null}
            className={`rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 ${
              busy ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {save.isPending ? "Saving…" : editingId ? "Update" : "State it"}
          </button>
        </div>
      </div>
    </div>
  );
}
