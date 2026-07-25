"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listCrmUploads,
  listAudiences,
  createAudience,
  setAudienceStatus,
  type AudienceWire,
} from "@/lib/api";
import {
  buildCrmSourceAudienceRows,
  unboundCrmAudiences,
  type AudienceLike,
  type CrmSourceAudienceRow,
} from "@/lib/crm-source-audiences";

// Every CSV a brand has imported into crm-service is a "source". This card turns
// each one on or off as its OWN human-service audience: ON creates (or
// re-activates) an audience bound to that source, OFF pauses it. Binding one
// audience per source is what makes per-source outreach economics possible —
// a single whole-brand CRM audience pools every file into one bucket.

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "—";
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

function Toggle({
  on,
  disabled,
  busy,
  onClick,
  label,
}: {
  on: boolean;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        on ? "bg-brand-500" : "bg-gray-200"
      } ${
        busy
          ? "cursor-wait"
          : disabled
            ? "opacity-40 cursor-not-allowed"
            : "cursor-pointer"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function CrmSourceAudiencesCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);

  // Same key as the CRM Sources page → one shared fetch, no duplicate poll.
  const {
    data: uploadsData,
    isPending: uploadsPending,
    isError: uploadsError,
  } = useAuthQuery(["crmUploads", brandId], () => listCrmUploads(brandId));

  const {
    data: audiencesData,
    isPending: audiencesPending,
    isError: audiencesError,
  } = useAuthQuery(["audiences", brandId], () => listAudiences(brandId));

  // Reveal on SETTLE (resolved OR errored) — a failing read must degrade to an
  // empty/stale table, never an eternal skeleton.
  const settled =
    (!uploadsPending || uploadsError) && (!audiencesPending || audiencesError);

  const uploads = useMemo(() => uploadsData?.uploads ?? [], [uploadsData]);
  const audiences: AudienceLike[] = useMemo(
    () =>
      (audiencesData?.audiences ?? []).map((a: AudienceWire) => ({
        id: a.id,
        name: a.name,
        provider: a.provider,
        status: a.status,
        crmSourceUploadId: a.crmSourceUploadId ?? null,
      })),
    [audiencesData],
  );

  const rows = useMemo(
    () => buildCrmSourceAudienceRows(uploads, audiences),
    [uploads, audiences],
  );
  const unbound = useMemo(() => unboundCrmAudiences(audiences), [audiences]);
  const activeCount = rows.filter((r) => r.enabled).length;

  const { mutate, error } = useMutation({
    mutationFn: async ({ row, next }: { row: CrmSourceAudienceRow; next: boolean }) => {
      if (!next) {
        if (!row.audienceId) throw new Error("No audience bound to this source");
        return setAudienceStatus(row.audienceId, "paused");
      }
      let audienceId = row.audienceId;
      if (!audienceId) {
        if (!row.filename) throw new Error("Source has no filename to name the audience after");
        const created = await createAudience({
          brandId,
          name: row.filename,
          provider: "crm",
          crmSourceUploadId: row.uploadId,
        });
        audienceId = created.audience.id;
      }
      // A freshly created audience lands at "suggested" — activating is a
      // separate status write, same call as re-enabling an existing one.
      return setAudienceStatus(audienceId, "active");
    },
    onMutate: ({ row }) => {
      setPendingUploadId(row.uploadId);
    },
    onSuccess: (res) => {
      // Write the fresh audience into the list cache so the switch flips without
      // waiting on the refetch, then let the invalidation reconcile.
      queryClient.setQueryData(
        ["audiences", brandId],
        (prev: { audiences: AudienceWire[]; total: number } | undefined) => {
          if (!prev) return prev;
          const exists = prev.audiences.some((a) => a.id === res.audience.id);
          return {
            ...prev,
            audiences: exists
              ? prev.audiences.map((a) => (a.id === res.audience.id ? res.audience : a))
              : [...prev.audiences, res.audience],
            total: exists ? prev.total : prev.total + 1,
          };
        },
      );
      return queryClient.invalidateQueries({ queryKey: ["audiences", brandId] });
    },
    onSettled: () => {
      setPendingUploadId(null);
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold text-gray-900">CRM sources</h3>
        {settled && rows.length > 0 && (
          <span className="text-xs text-gray-500 shrink-0">
            {activeCount} of {rows.length} on
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Each CSV imported for this brand can be switched on as its own audience. Only the
        sources that are on get contacted, and each one reports its own cost per outcome.
      </p>

      {unbound.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {unbound.length === 1 ? "One CRM audience is" : `${unbound.length} CRM audiences are`}{" "}
          not tied to a single source ({unbound.map((a) => a.name).join(", ")}). While one of
          them is active it draws from every imported file, so the switches below do not fully
          describe who gets contacted.
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600">
          Could not update: {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}

      {!settled ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No CSV imported for this brand yet. Import one from the brand&apos;s CRM Sources page.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {rows.map((row) => {
            const busy = pendingUploadId === row.uploadId;
            const blocked = row.filename === null;
            return (
              <li key={row.uploadId} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {row.filename ?? "Unnamed file"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {row.rowCount.toLocaleString("en-US")} rows
                    {row.uploadStatus ? ` · ${row.uploadStatus}` : ""} ·{" "}
                    {timeAgo(row.uploadedAt)}
                    {blocked ? " · no filename, cannot name an audience" : ""}
                  </p>
                </div>
                <span className={`text-xs shrink-0 ${row.enabled ? "text-brand-700" : "text-gray-400"}`}>
                  {busy ? "Saving…" : row.enabled ? "On" : "Off"}
                </span>
                <Toggle
                  on={row.enabled}
                  busy={busy}
                  disabled={busy || blocked}
                  label={`Use ${row.filename ?? "this source"} as an audience`}
                  onClick={() => mutate({ row, next: !row.enabled })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
