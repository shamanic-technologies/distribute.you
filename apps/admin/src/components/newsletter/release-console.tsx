"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { ApiError } from "@/lib/api";
import {
  listMailingListReleases,
  setMailingListReleaseState,
  setMailingListReleasePace,
} from "@/lib/api";
import {
  RELEASE_STATUS_LABEL,
  RELEASE_STATUS_TONE,
  estimatedRemainingLabel,
  paceProblemShape,
  releaseActivityLine,
  releaseControls,
  releaseProgressPct,
  releaseWriteErrorMessage,
  todayUsedPct,
  type MailingListRelease,
} from "@/lib/mailing-list-release";

/**
 * Watch and steer a paced mailing-list release.
 *
 * The control that matters here is PAUSE. A release covers tens of thousands of
 * people over days, and the provider's complaint threshold applies to the whole
 * account — so a spike on this send suspends onboarding and dunning mail too.
 * Being able to stop it from a phone is the reason this surface exists, which is
 * why pause is the first thing on the card rather than the last.
 *
 * Every figure is served. Nothing here divides, sums or infers: the two bars are
 * pictures of ratios the service already states, and the numbers beside them are
 * its own counts.
 */

const LIST_SLUG = "newsletter";

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
}

/** The status code of a refusal, or null when the throw was not one. */
function statusOf(err: unknown): number | null {
  return err instanceof ApiError ? err.status : null;
}

/**
 * The reason the service wrote for a person, when it supplied one.
 *
 * NEVER `err.message` — the api client sets that to the whole downstream body
 * verbatim, which is how a JSON blob reaches a reader.
 */
function servedReasonOf(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const served = err.body?.error;
  return typeof served === "string" && served.trim() ? served : null;
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ReleaseCard({
  release,
  onChanged,
}: {
  release: MailingListRelease;
  onChanged: (next: MailingListRelease) => void;
}) {
  const controls = releaseControls(release.status);
  const [busy, setBusy] = useState<null | "pause" | "resume" | "cancel" | "pace">(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [paceDraft, setPaceDraft] = useState(String(release.dailyLimit));
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function move(action: "pause" | "resume" | "cancel") {
    setProblem(null);
    setBusy(action);
    try {
      onChanged(await setMailingListReleaseState(release.releaseId, action));
      setConfirmingCancel(false);
    } catch (err) {
      console.error(`[newsletter] release ${action} failed`, err);
      setProblem(releaseWriteErrorMessage(statusOf(err), servedReasonOf(err)));
    } finally {
      setBusy(null);
    }
  }

  async function repace() {
    const shape = paceProblemShape(paceDraft);
    if (shape) {
      setProblem(shape);
      return;
    }
    setProblem(null);
    setBusy("pace");
    try {
      onChanged(await setMailingListReleasePace(release.releaseId, Number(paceDraft.trim())));
    } catch (err) {
      console.error("[newsletter] release repace failed", err);
      setProblem(releaseWriteErrorMessage(statusOf(err), servedReasonOf(err)));
    } finally {
      setBusy(null);
    }
  }

  const remainingLabel = estimatedRemainingLabel(release);
  const paceDirty = paceDraft.trim() !== String(release.dailyLimit);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">{release.subject}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            From {release.from} · {fmt(release.recipientCount)} recipients
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${RELEASE_STATUS_TONE[release.status]}`}
        >
          {RELEASE_STATUS_LABEL[release.status]}
        </span>
      </div>

      {/* Pause first: it is the reason this surface exists. */}
      {(controls.canPause || controls.canResume || controls.canCancel) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {controls.canPause && (
            <button
              onClick={() => move("pause")}
              disabled={busy !== null}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white ${
                busy === "pause" ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {busy === "pause" ? "Pausing…" : "Pause"}
            </button>
          )}
          {controls.canResume && (
            <button
              onClick={() => move("resume")}
              disabled={busy !== null}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white ${
                busy === "resume" ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {busy === "resume" ? "Resuming…" : "Resume"}
            </button>
          )}
          {controls.canCancel &&
            (confirmingCancel ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Cancel for good?</span>
                <button
                  onClick={() => move("cancel")}
                  disabled={busy !== null}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 text-red-700 border border-red-200"
                >
                  {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button
                  onClick={() => setConfirmingCancel(false)}
                  className="px-2 py-1.5 text-sm text-gray-600"
                >
                  Keep it
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingCancel(true)}
                disabled={busy !== null}
                className="px-3 py-1.5 text-sm text-gray-600 rounded-lg border border-gray-200"
              >
                Cancel
              </button>
            ))}
        </div>
      )}

      <p className="mt-3 text-sm text-gray-600">{releaseActivityLine(release)}</p>

      {release.haltedReason && (
        <p className="mt-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
          {release.haltedReason}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-baseline justify-between text-xs text-gray-500 mb-1">
            <span>
              {fmt(release.reached)} of {fmt(release.recipientCount)} reached
            </span>
            {remainingLabel && <span>{remainingLabel}</span>}
          </div>
          <Bar pct={releaseProgressPct(release)} tone="bg-gray-900" />
        </div>
        <div>
          <div className="flex items-baseline justify-between text-xs text-gray-500 mb-1">
            <span>
              Today: {fmt(release.todayUsed)} of {fmt(release.todayAllowance)}
            </span>
            <span>{fmt(release.dailyLimit)}/day</span>
          </div>
          <Bar pct={todayUsedPct(release)} tone="bg-gray-400" />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Waiting</dt>
          <dd className="text-gray-800 font-medium">{fmt(release.remaining)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Failed</dt>
          <dd className="text-gray-800 font-medium">{fmt(release.failed)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Opted out</dt>
          <dd className="text-gray-800 font-medium">{fmt(release.skippedOptedOut)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">In flight</dt>
          <dd className="text-gray-800 font-medium">{fmt(release.inFlight)}</dd>
        </div>
      </dl>

      {controls.canRepace && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-xs text-gray-500 mb-1" htmlFor={`pace-${release.releaseId}`}>
            Daily pace
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              id={`pace-${release.releaseId}`}
              type="text"
              inputMode="numeric"
              value={paceDraft}
              onChange={(e) => {
                setPaceDraft(e.target.value);
                setProblem(null);
              }}
              className="w-28 px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-300 focus:outline-none"
            />
            <span className="text-sm text-gray-500">per day</span>
            {paceDirty && (
              <button
                onClick={repace}
                disabled={busy !== null}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white ${
                  busy === "pace" ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {busy === "pace" ? "Saving…" : "Update pace"}
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Governs from now on. Nothing already sent is disturbed, and lowering it below what today
            has already sent claws nothing back.
          </p>
        </div>
      )}

      {problem && <p className="mt-3 text-sm text-red-700">{problem}</p>}
    </div>
  );
}

export function ReleaseConsole() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useAuthQuery(
    ["mailingListReleases", LIST_SLUG],
    () => listMailingListReleases(LIST_SLUG),
    pollOptions
  );

  /**
   * A write answers with the release it just changed, so it is written straight
   * into the cache rather than invalidated: the poll is 30s and a pause that
   * takes half a minute to show reads as a dead button on the one control
   * somebody is pressing because they are worried.
   */
  function onChanged(next: MailingListRelease) {
    queryClient.setQueryData(
      ["mailingListReleases", LIST_SLUG],
      (prev: { slug: string; count: number; releases: MailingListRelease[] } | undefined) =>
        prev
          ? {
              ...prev,
              releases: prev.releases.map((r) => (r.releaseId === next.releaseId ? next : r)),
            }
          : prev
    );
  }

  // Reveal on settle: an errored read paints its own line rather than a
  // skeleton that never resolves.
  if (isPending && !isError) {
    return (
      <div className="space-y-3">
        <div className="h-40 bg-white rounded-xl border border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-600">
          Could not read the releases for this list. Nothing changed; the page retries on its own.
        </p>
      </div>
    );
  }

  if (data.releases.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-600">
          No release has been created for <span className="font-medium">{LIST_SLUG}</span> yet.
          Nothing has been sent to this list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.releases.map((release) => (
        <ReleaseCard key={release.releaseId} release={release} onChanged={onChanged} />
      ))}
    </div>
  );
}
