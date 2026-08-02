"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { Skeleton } from "@/components/skeleton";
import {
  listInvestorSubscribers,
  listInvestorUpdates,
  sendInvestorUpdate,
  type InvestorUpdateRecord,
} from "@/lib/api";
import {
  renderInvestorUpdateHtml,
  renderInvestorUpdateText,
  investorUpdateBlocker,
  imageMarkdown,
} from "@/lib/investor-update-html";

const SUBSCRIBERS_KEY = ["investorSubscribers"] as const;
const UPDATES_KEY = ["investorUpdates"] as const;

function sentAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PastUpdate({ update }: { update: InvestorUpdateRecord }) {
  const [open, setOpen] = useState(false);
  const failures = update.failures ?? [];
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded-lg"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{update.subject}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {sentAtLabel(update.sentAt)} · {update.recipientCount}{" "}
            {update.recipientCount === 1 ? "recipient" : "recipients"}
            {failures.length > 0 ? (
              <span className="text-red-600"> · {failures.length} failed</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{open ? "Hide" : "View"}</span>
      </button>

      {open ? (
        <div className="border-t border-gray-100 px-4 py-4">
          {failures.length > 0 ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-medium text-red-800">These did not go out:</p>
              <ul className="mt-1 space-y-0.5">
                {failures.map((f) => (
                  <li key={f.email} className="text-xs text-red-700">
                    <span className="font-mono">{f.email}</span> — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* The body exactly as it was sent, rendered the same way the recipient saw it. */}
          <div
            className="rounded-lg border border-gray-200 overflow-hidden"
            dangerouslySetInnerHTML={{ __html: update.html }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function InvestorUpdateComposer() {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscribersQuery = useAuthQuery(SUBSCRIBERS_KEY, () => listInvestorSubscribers());
  const updatesQuery = useAuthQuery(UPDATES_KEY, () => listInvestorUpdates());

  // Only people who have not opted out will receive it — that is the number to
  // show beside a Send button, not the size of the list.
  const recipientCount = (subscribersQuery.data?.subscribers ?? []).filter(
    (s) => !s.unsubscribed
  ).length;

  // The preview renders the SAME string that is sent. A preview built from a
  // second code path could disagree with what lands in the inbox.
  const html = useMemo(() => renderInvestorUpdateHtml(body), [body]);

  const blocker = investorUpdateBlocker(subject, body);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendInvestorUpdate({ subject: subject.trim(), html, text: renderInvestorUpdateText(body) }),
    onSuccess: async (result) => {
      const { recipientCount: reached, failures } = result.update;
      setSubject("");
      setBody("");
      setImageUrl("");
      setImageAlt("");
      setShowPreview(false);
      setConfirming(false);
      setError(null);
      setNotice(
        failures?.length
          ? `Sent to ${reached}. ${failures.length} failed — open it below to see which.`
          : `Sent to ${reached} ${reached === 1 ? "investor" : "investors"}.`
      );
      await queryClient.invalidateQueries({ queryKey: UPDATES_KEY });
    },
    onError: (err: Error) => {
      setNotice(null);
      setConfirming(false);
      console.error("[admin] sendInvestorUpdate failed", err);
      setError("The update did not go out. Nothing was sent.");
    },
  });

  const sending = sendMutation.isPending;

  const insertImage = () => {
    const url = imageUrl.trim();
    if (!url) return;
    const snippet = imageMarkdown(url, imageAlt);
    setBody((current) => (current.trimEnd().length > 0 ? `${current.trimEnd()}\n\n${snippet}\n` : `${snippet}\n`));
    setImageUrl("");
    setImageAlt("");
    setNotice(null);
    bodyRef.current?.focus();
  };

  const updates = updatesQuery.data?.updates ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label htmlFor="investor-subject" className="block text-sm font-medium text-gray-900">
            Subject
          </label>
          <input
            id="investor-subject"
            type="text"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setNotice(null);
              setConfirming(false);
            }}
            placeholder="distribute — Q3 investor update"
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div>
          <label htmlFor="investor-body" className="block text-sm font-medium text-gray-900">
            Update
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            Markdown. <code>**bold**</code>, <code>## heading</code>, <code>- bullet</code>,{" "}
            <code>[text](url)</code>.
          </p>
          <textarea
            id="investor-body"
            ref={bodyRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setNotice(null);
              setConfirming(false);
            }}
            rows={14}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder={"## Where we are\n\nWe shipped ...\n\n## Numbers\n\n- ARR: ...\n- Customers: ..."}
          />
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-700">Add an image</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Paste a public image URL. It is inserted at the end of the update; move the line
            wherever you want it.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <input
              type="text"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              placeholder="Describe it"
              className="w-full sm:w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="button"
              onClick={insertImage}
              disabled={imageUrl.trim().length === 0}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              Insert
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            {subscribersQuery.isPending ? (
              <Skeleton className="h-4 w-40" />
            ) : subscribersQuery.isError ? (
              "Could not read the list."
            ) : (
              <>
                Goes to <span className="font-medium text-gray-700">{recipientCount}</span>{" "}
                {recipientCount === 1 ? "investor" : "investors"}, one message each.
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              {showPreview ? "Hide preview" : "Preview"}
            </button>
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={sending}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => sendMutation.mutate()}
                  disabled={sending}
                  className={`inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                    sending ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  {sending ? "Sending..." : `Yes, send to ${recipientCount}`}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setError(null);
                  setConfirming(true);
                }}
                disabled={blocker !== null || recipientCount === 0}
                title={blocker ?? (recipientCount === 0 ? "Nobody on the list yet." : undefined)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                Send update
              </button>
            )}
          </div>
        </div>

        {blocker ? <p className="text-xs text-gray-500">{blocker}</p> : null}
        {notice ? <p className="text-xs font-medium text-green-700">{notice}</p> : null}
        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      </div>

      {showPreview ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
          <p className="mt-1 text-xs text-gray-500">
            This is the email, not an approximation of it — the same HTML is what gets sent. The
            unsubscribe link resolves per recipient when it goes out.
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
            <p className="text-xs text-gray-500">
              From <span className="font-medium text-gray-700">kevin@distribute.you</span>
            </p>
            <p className="text-sm font-medium text-gray-900">
              {subject.trim() || <span className="text-gray-300">No subject yet</span>}
            </p>
          </div>
          <div
            className="mt-3 rounded-lg border border-gray-200 overflow-hidden"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Updates sent</h2>
        {updatesQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : updatesQuery.isError ? (
          <p className="text-sm text-gray-500">Could not load the history. It will retry on its own.</p>
        ) : updates.length === 0 ? (
          <p className="text-sm text-gray-500">No updates sent yet.</p>
        ) : (
          <div className="space-y-2">
            {updates.map((u) => (
              <PastUpdate key={u.id} update={u} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
