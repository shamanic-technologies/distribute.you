"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { Skeleton } from "@/components/skeleton";
import {
  listInvestorSubscribers,
  addInvestorSubscribers,
  removeInvestorSubscriber,
  type InvestorSubscriber,
} from "@/lib/api";
import { parseEmailBlob, describeParsedBlob } from "@/lib/investor-emails";

const SUBSCRIBERS_KEY = ["investorSubscribers"] as const;

/** Long dates read as noise in a list; the day is enough to place an entry. */
function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SubscriberRow({
  subscriber,
  onRemove,
  removing,
}: {
  subscriber: InvestorSubscriber;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const added = shortDate(subscriber.addedAt);
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{subscriber.email}</div>
          {subscriber.name ? (
            <div className="text-xs text-gray-500 truncate">{subscriber.name}</div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {subscriber.unsubscribed ? (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Unsubscribed
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            Subscribed
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{added ?? "-"}</td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <button
          type="button"
          onClick={() => onRemove(subscriber.id)}
          disabled={removing}
          className={`text-xs font-medium text-gray-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded px-2 py-1 ${
            removing ? "cursor-wait" : "disabled:opacity-40"
          }`}
        >
          {removing ? "Removing..." : "Remove"}
        </button>
      </td>
    </tr>
  );
}

export function InvestorListView() {
  const queryClient = useQueryClient();
  const [blob, setBlob] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data, isPending, isError } = useAuthQuery(SUBSCRIBERS_KEY, () => listInvestorSubscribers());

  // Parsed only to SHOW the user what a paste would do. The producer owns dedup
  // against what is already stored, so these counts describe the paste, not the
  // list — the real result comes back from the write.
  const parsed = useMemo(() => parseEmailBlob(blob), [blob]);
  const parseSummary = describeParsedBlob(parsed);

  const subscribers = data?.subscribers ?? [];
  const subscribedCount = subscribers.filter((s) => !s.unsubscribed).length;

  const addMutation = useMutation({
    mutationFn: () => addInvestorSubscribers(parsed.accepted),
    onSuccess: async (result) => {
      setBlob("");
      setError(null);
      const bits = [`${result.added} added`];
      if (result.skipped > 0) bits.push(`${result.skipped} already on the list`);
      if (result.rejected?.length) bits.push(`${result.rejected.length} rejected`);
      setNotice(bits.join(", "));
      await queryClient.invalidateQueries({ queryKey: SUBSCRIBERS_KEY });
    },
    onError: (err: Error) => {
      setNotice(null);
      console.error("[admin] addInvestorSubscribers failed", err);
      setError("Could not add those addresses. Nothing was saved.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeInvestorSubscriber(id),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: SUBSCRIBERS_KEY });
    },
    onError: (err: Error) => {
      console.error("[admin] removeInvestorSubscriber failed", err);
      setError("Could not remove that address.");
    },
    onSettled: () => setRemovingId(null),
  });

  const handleRemove = (id: string) => {
    setRemovingId(id);
    removeMutation.mutate(id);
  };

  const adding = addMutation.isPending;
  // Nothing valid in the box means there is nothing to send; a paste made
  // entirely of rejects should say so rather than arm the button.
  const canAdd = parsed.accepted.length > 0 && !adding;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Add addresses</h2>
        <p className="mt-1 text-xs text-gray-500">
          One per line, or separated by commas or semicolons. <code>Name &lt;email&gt;</code> pairs work too.
        </p>
        <textarea
          value={blob}
          onChange={(e) => {
            setBlob(e.target.value);
            setNotice(null);
          }}
          rows={6}
          spellCheck={false}
          placeholder={"alice@fund.com\nBob Chen <bob@vc.io>\ncarol@angels.co"}
          className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />

        {parsed.rejected.length > 0 ? (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs font-medium text-amber-800">
              {parsed.rejected.length === 1
                ? "This one is not an email address and will be skipped:"
                : `These ${parsed.rejected.length} are not email addresses and will be skipped:`}
            </p>
            <p className="mt-1 text-xs text-amber-700 font-mono break-all">
              {parsed.rejected.join(", ")}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">{parseSummary ?? " "}</p>
          <button
            type="button"
            onClick={() => addMutation.mutate()}
            disabled={!canAdd}
            className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
              adding ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {adding ? "Adding..." : "Add to list"}
          </button>
        </div>

        {notice ? <p className="mt-3 text-xs font-medium text-green-700">{notice}</p> : null}
        {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Subscribers
            {!isPending && !isError ? (
              <span className="ml-2 font-normal text-gray-500">
                {subscribedCount} receiving updates
                {subscribers.length > subscribedCount
                  ? `, ${subscribers.length - subscribedCount} unsubscribed`
                  : ""}
              </span>
            ) : null}
          </h2>
        </div>

        {isPending ? (
          <div className="space-y-3 px-5 pb-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="px-5 pb-5 text-sm text-gray-500">
            Could not load the list. It will retry on its own.
          </p>
        ) : subscribers.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-gray-500">
            Nobody on the list yet. Paste some addresses above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full md:min-w-[560px]">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 pb-2 font-medium">Address</th>
                  <th className="px-4 pb-2 font-medium">Status</th>
                  <th className="px-4 pb-2 font-medium">Added</th>
                  <th className="px-4 pb-2" />
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <SubscriberRow
                    key={s.id}
                    subscriber={s}
                    onRemove={handleRemove}
                    removing={removingId === s.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
