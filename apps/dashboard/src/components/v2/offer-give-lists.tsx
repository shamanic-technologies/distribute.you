"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getOfferUserFields, saveOfferUserFields, type BrandUserFields } from "@/lib/api";
import { giveListLines, giveListsEqual, giveListsPayload, parseGiveListText, type GiveLists } from "@/lib/offer-channel-settings";
import { Shimmer } from "@/components/v2/ui";
import { editedDraftedKeys, editedNote, offerFieldsDraftedUnit } from "@/lib/unit-reports";
import { logReportFailure, useUnitReport } from "@/lib/use-unit-report";

const GIVE_FIELDS = [
  { key: "giveForFree", label: "We give for free", tip: "What an email may offer at no cost." },
  { key: "neverGive", label: "We never give", tip: "What an email must never offer." },
] as const;

/**
 * What the offer gives away: its two give lists, on the offer's user-fields, read by
 * content-generation on every email. They belong to the OFFER, not to one channel, so
 * the offer page is their one editable home (owner 2026-11-03, moved off cold email's
 * Settings tab). Each list saves on its own when the field is left: no Save button.
 */
export function OfferGiveLists({ brandId, offerId }: { brandId: string; offerId: string }) {
  const qc = useQueryClient();
  const sendReport = useUnitReport();
  const fields = useAuthQuery(["offerUserFields", brandId, offerId], () => getOfferUserFields(brandId, offerId), {
    ...pollOptions,
    enabled: !!brandId && !!offerId,
  });

  const served = useMemo<GiveLists | null>(() => giveListsFrom(fields.data?.fields), [fields.data]);
  const suggested = useMemo(() => {
    const f = fields.data?.fields;
    return GIVE_FIELDS.some((g) => f?.[g.key]?.provenance !== "confirmed" && giveListLines(f?.[g.key]?.value).length > 0);
  }, [fields.data]);

  /** One list changed: both keys go out (an omitted key is left as stored, an emptied one is []). */
  const saveList = async (key: keyof GiveLists, lines: string[]) => {
    if (!served) throw new Error("[offer-give-lists] give lists not read yet");
    const next = { ...served, [key]: lines };
    if (giveListsEqual(next, served)) return;
    const res = await saveOfferUserFields(brandId, offerId, giveListsPayload(next));
    // A list we drafted and the client changed: the draft was not good (SCRIPT-VALUE-RATING-1113).
    const edited = editedDraftedKeys(fields.data?.fields, giveListsPayload(next));
    if (edited.length > 0) {
      const unit = offerFieldsDraftedUnit(brandId, offerId);
      sendReport(unit, "edited", editedNote(edited)).catch(logReportFailure("give lists", unit));
    }
    qc.setQueryData(["offerUserFields", brandId, offerId], res);
    // setQueryData never reaches the on-disk cache: re-read so a reload paints the saved lists.
    await qc.invalidateQueries({ queryKey: ["offerUserFields", brandId, offerId] });
  };

  const fieldsSettled = fields.isFetchedAfterMount || fields.data !== undefined;

  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="k-fg text-[14px] font-medium">What you give away</h2>
        {suggested && <span className="k-chip">Suggested, not saved</span>}
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">Every email reads these two lists. Click a list to edit it.</p>
      {!fieldsSettled ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GIVE_FIELDS.map((g) => (
            <div key={g.key} className="k-card p-3">
              <Shimmer className="h-4 w-1/3 rounded-md" />
              <Shimmer className="mt-2 h-3 w-2/3 rounded-md" />
              <Shimmer className="mt-3 h-7 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : (fields.isError && !fields.data) || !served ? (
        <p className="k-fg3 mt-3 text-[13px]">Could not read this offer&apos;s give lists.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GIVE_FIELDS.map((g) => (
            <InlineList
              key={g.key}
              id={`offer-${g.key}`}
              label={g.label}
              tip={g.tip}
              lines={served[g.key]}
              onSave={(lines) => saveList(g.key, lines)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One list in its card: reads as bullets and turns into a textarea on click. Leaving the
 * field saves it; while the save is in flight the typed lines are shown, and a refused
 * save reopens the field with the text kept and says so. Esc drops the edit.
 */
function InlineList({
  id,
  label,
  tip,
  lines,
  onSave,
}: {
  id: string;
  label: string;
  tip: string;
  lines: string[];
  onSave: (lines: string[]) => Promise<void>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? lines;

  const commit = async () => {
    if (text === null) return;
    const next = parseGiveListText(text);
    setText(null);
    setPending(next);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      console.error("[offer-give-lists] give list save failed", { label, err });
      setText(next.join("\n"));
      setError("Not saved. Try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="k-card min-w-0 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="k-fg text-[13px] font-medium">
          {label}
        </label>
        <span className={`text-[12px] tabular-nums ${error ? "text-[var(--data-rose)]" : "k-fg3"}`}>
          {error ?? (pending ? "Saving…" : shown.length === 0 ? "Empty" : `${shown.length} ${shown.length === 1 ? "item" : "items"}`)}
        </span>
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">{tip}</p>
      <div className="mt-2">
        {text !== null ? (
          <textarea
            id={id}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setText(null);
                setError(null);
              }
            }}
            rows={Math.max(3, text.split("\n").length + 1)}
            placeholder="One item per line"
            // k-input pins a 28px control height; this field holds a list.
            style={{ height: "auto", font: "inherit", fontSize: 13 }}
            className="k-input w-full resize-y px-2 py-0.5 leading-[20px]"
          />
        ) : (
          <button
            id={id}
            type="button"
            onClick={() => setText(shown.join("\n"))}
            className="k-hover block w-full cursor-text rounded-lg px-2 py-0.5 text-left text-[13px] leading-[20px]"
          >
            {shown.length === 0 ? (
              <span className="k-fg4">Nothing yet. Click to add.</span>
            ) : (
              <ul className="space-y-0.5">
                {shown.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="k-fg3">•</span>
                    <span className="min-w-0">{l}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/** The two lists as brand-service serves them; null until the read answers. */
export function giveListsFrom(f: BrandUserFields | undefined): GiveLists | null {
  if (!f) return null;
  return { giveForFree: giveListLines(f.giveForFree?.value), neverGive: giveListLines(f.neverGive?.value) };
}
