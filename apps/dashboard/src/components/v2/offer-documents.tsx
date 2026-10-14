"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  deleteOfferDocument,
  getOfferDocumentContent,
  listOfferDocuments,
  updateOfferDocument,
  uploadOfferDocument,
} from "@/lib/api";
import {
  OFFER_DOCUMENT_ACCEPT,
  formatFileSize,
  offerDocumentRefusal,
  opensInBrowser,
  type OfferDocument,
} from "@/lib/offer-documents";
import { EmptyNote, Shimmer } from "@/components/v2/ui";

const DESCRIPTION_PLACEHOLDER = "When they ask for proof or a similar client";

/** brand-service's refusal, in our words. */
function refusalOf(err: unknown): string {
  if (err instanceof ApiError) {
    const reason = typeof err.body?.reason === "string" ? err.body.reason : null;
    return offerDocumentRefusal(err.status, reason);
  }
  return offerDocumentRefusal(null, null);
}

function FileMark({ contentType }: { contentType: string }) {
  const isImage = contentType.startsWith("image/");
  return (
    <span
      aria-hidden
      className="k-inset grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[var(--fg-2)] shadow-[inset_0_0_0_1px_var(--line)]"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
        {isImage ? (
          <>
            <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
            <circle cx="6" cy="6.5" r="1" />
            <path d="M3 12l3.5-3.5 2.5 2.5 2-2 2.5 2.5" />
          </>
        ) : (
          <>
            <path d="M4 1.5h5l3.5 3.5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1z" />
            <path d="M9 1.5V5h3.5M5.5 8.5h5M5.5 11h3.5" />
          </>
        )}
      </svg>
    </span>
  );
}

/** The "when it helps" line: reads as text, a click turns it into its field, blur saves, Esc drops. */
function InlineDescription({ doc, onSave }: { doc: OfferDocument; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? doc.description;

  const commit = async () => {
    if (text === null) return;
    const next = text.trim();
    if (next === doc.description) {
      setText(null);
      setError(null);
      return;
    }
    if (!next) {
      setError("Say in one line when it helps.");
      return;
    }
    setText(null);
    setPending(next);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      console.error("[offer-documents] description save failed", { documentId: doc.id, err });
      setText(next);
      setError(refusalOf(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-w-0">
      {text !== null ? (
        <input
          autoFocus
          value={text}
          aria-label={`When ${doc.fileName} helps`}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(null);
              setError(null);
            }
          }}
          maxLength={1000}
          // Opens IN the text's own box: same padding, same font as the reading state.
          style={{ font: "inherit" }}
          className="-mx-1.5 block w-[calc(100%+12px)] rounded-[6px] bg-[var(--bg-hover)] px-1.5 py-0.5 text-[13px] leading-[20px] outline-none ring-1 ring-[var(--accent)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setText(shown)}
          className="k-hover -mx-1.5 block w-[calc(100%+12px)] cursor-text rounded-[6px] px-1.5 py-0.5 text-left text-[13px] leading-[20px]"
        >
          {shown}
          {pending !== null && <span className="k-fg3 ml-2 text-[12px]">Saving…</span>}
        </button>
      )}
      {error && <p className="mt-0.5 text-[12px] text-[var(--data-rose)]">{error}</p>}
    </div>
  );
}

function AddFilePanel({
  brandId,
  offerId,
  onDone,
}: {
  brandId: string;
  offerId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    setError(null);
  };

  const submit = async () => {
    if (!file) {
      setError("Pick a file first.");
      return;
    }
    if (!description.trim()) {
      setError("Say in one line when it helps.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await uploadOfferDocument(brandId, offerId, file, description.trim());
      await qc.invalidateQueries({ queryKey: ["offerDocuments", brandId, offerId] });
      onDone();
    } catch (err) {
      console.error("[offer-documents] upload failed", { fileName: file.name, sizeBytes: file.size, err });
      setError(refusalOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="k-line-subtle space-y-3 border-b p-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`k-inset flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-3 text-[13px] ${dragging ? "ring-1 ring-[var(--accent)]" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={OFFER_DOCUMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {file ? (
          <>
            <FileMark contentType={file.type} />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className="k-fg3 text-[12px] tabular-nums">{formatFileSize(file.size)}</span>
          </>
        ) : (
          <span className="k-fg2">Drop a file here, or click to pick one. PDF, Word, slides or image, up to 5 MB.</span>
        )}
      </label>
      <div>
        <label htmlFor="offer-document-description" className="k-label mb-1.5 block">
          When should our AI attach it?
        </label>
        <input
          id="offer-document-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") onDone();
          }}
          maxLength={1000}
          placeholder={DESCRIPTION_PLACEHOLDER}
          className="k-input w-full"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving} className="k-btn-accent disabled:opacity-40">
          {saving ? "Adding…" : "Add file"}
        </button>
        <button type="button" onClick={onDone} className="k-btn-ghost">
          Cancel
        </button>
        {error && (
          <p role="alert" className="text-[12px] text-[var(--data-rose)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onBlur={() => setArmed(false)}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        try {
          await onRemove();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
      className={`k-btn-ghost text-[12px] ${armed ? "text-[var(--data-rose)]" : "k-fg3"}`}
    >
      {busy ? "Removing…" : armed ? "Click to remove" : "Remove"}
    </button>
  );
}

/**
 * The offer's files for replies (case studies, one-pagers): when a prospect answers
 * positively, our AI can attach the one that fits. Add, describe, open, remove.
 */
export function OfferDocuments({ brandId, offerId }: { brandId: string; offerId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const key = ["offerDocuments", brandId, offerId] as const;
  const q = useAuthQuery(key, () => listOfferDocuments(brandId, offerId), {
    enabled: !!brandId && !!offerId,
    ...pollOptions,
  });
  const docs = q.data ?? null;

  const open = async (doc: OfferDocument) => {
    if (!opensInBrowser(doc.contentType)) return download(doc);
    // Open the tab inside the click, then point it at the file once it has loaded:
    // a window opened after an await is blocked as a popup.
    const tab = window.open("", "_blank");
    try {
      const blob = await getOfferDocumentContent(brandId, offerId, doc.id);
      const url = URL.createObjectURL(new Blob([blob], { type: doc.contentType }));
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      console.error("[offer-documents] open failed", { documentId: doc.id, err });
      setRowError(`Could not open ${doc.fileName}. Try again.`);
    }
  };

  // A file no tab can show (Word, slides, sheets) is saved under its own name.
  const download = async (doc: OfferDocument) => {
    try {
      const blob = await getOfferDocumentContent(brandId, offerId, doc.id);
      const url = URL.createObjectURL(new Blob([blob], { type: doc.contentType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("[offer-documents] download failed", { documentId: doc.id, err });
      setRowError(`Could not open ${doc.fileName}. Try again.`);
    }
  };

  const save = async (doc: OfferDocument, description: string) => {
    await updateOfferDocument(brandId, offerId, doc.id, { description });
    await qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (doc: OfferDocument) => {
    setRowError(null);
    try {
      await deleteOfferDocument(brandId, offerId, doc.id);
      await qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      console.error("[offer-documents] remove failed", { documentId: doc.id, err });
      setRowError(`${doc.fileName} was not removed. Try again.`);
    }
  };

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="k-fg text-[14px] font-medium">
            Files for replies
            {docs && <span className="k-fg3 ml-1.5 font-normal tabular-nums">{docs.length}</span>}
          </h2>
          <p className="k-fg3 mt-0.5 text-[12px]">
            When a prospect answers yes, our AI attaches the file that fits. Never on a cold email.
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="k-btn shrink-0">
            Add a file
          </button>
        )}
      </div>

      <div className="k-card mt-3 overflow-hidden">
        {adding && <AddFilePanel brandId={brandId} offerId={offerId} onDone={() => setAdding(false)} />}
        {!q.isFetchedAfterMount && !docs ? (
          <div className="space-y-2 p-4">
            <Shimmer className="h-6 w-full" />
            <Shimmer className="h-6 w-full" />
          </div>
        ) : !docs ? (
          <EmptyNote>Could not load this offer&apos;s files.</EmptyNote>
        ) : docs.length === 0 ? (
          adding ? null : <EmptyNote>No file yet. Add a case study or a one-pager.</EmptyNote>
        ) : (
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b text-left">
                  <th className="k-label px-3 py-2.5 font-normal first:pl-4">File</th>
                  <th className="k-label px-3 py-2.5 font-normal">When it helps</th>
                  <th className="k-label px-3 py-2.5 text-right font-normal">Size</th>
                  <th className="px-3 py-2.5 last:pr-4" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="k-row align-top">
                    <td className="px-3 py-2 first:pl-4">
                      <button
                        type="button"
                        onClick={() => void open(doc)}
                        title={`Open ${doc.fileName}`}
                        className="flex max-w-[280px] items-center gap-2 text-left hover:text-[var(--accent)]"
                      >
                        <FileMark contentType={doc.contentType} />
                        <span className="truncate">{doc.fileName}</span>
                      </button>
                    </td>
                    <td className="w-full px-3 py-2">
                      <InlineDescription doc={doc} onSave={(text) => save(doc, text)} />
                    </td>
                    <td className="k-fg2 whitespace-nowrap px-3 py-2 pt-2.5 text-right tabular-nums">
                      {formatFileSize(doc.sizeBytes)}
                    </td>
                    <td className="px-3 py-2 pt-1.5 text-right last:pr-4">
                      <RemoveButton onRemove={() => remove(doc)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rowError && (
          <p role="alert" className="k-line-subtle border-t px-4 py-2.5 text-[12px] text-[var(--data-rose)]">
            {rowError}
          </p>
        )}
      </div>
    </section>
  );
}
