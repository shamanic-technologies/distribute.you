"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@/lib/use-auth-query";
import { setSalesFunnelCampaignBrief } from "@/lib/api";
import type { SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";

const ROSE = "var(--data-rose)";

/**
 * A funnel campaign's BRIEF (campaign-service `brief`, PATCH `{brief}` through the gateway), the strategy in plain words.
 * One field for the client campaign page (P5.1) and the staff "Target, brief and plan" card: it reads as TEXT, a click
 * opens it in its own box, blur or Enter saves (no Save button), Shift+Enter is a new line, Esc drops. The typed value
 * shows while it saves; a refusal reopens the field with the text kept. Each surface passes its own words.
 */
export function BriefField({
  campaign,
  placeholder,
  emptyText,
  updatedNote,
}: {
  campaign: SalesFunnelCampaign;
  placeholder: string;
  /** What the text reads when no brief is stated. */
  emptyText: string;
  /** The line under a saved brief, from its served `briefUpdatedAt`; null = no line. */
  updatedNote: ((briefUpdatedAt: string) => string) | null;
}) {
  const qc = useQueryClient();
  const served = campaign.brief ?? "";
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropped = useRef(false);
  const save = useMutation({
    mutationFn: (next: string | null) => setSalesFunnelCampaignBrief(campaign.id, next, campaign.brandId),
    onSuccess: async (saved) => {
      // Every list holding this campaign reads the saved brief at once, then re-reads.
      for (const key of [["salesFunnelCampaigns", campaign.brandId, "all"], ["salesFunnelCampaigns", campaign.brandId, campaign.offerId]]) {
        qc.setQueryData<SalesFunnelCampaign[]>(key, (old) => old?.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)));
      }
      await qc.invalidateQueries({ queryKey: ["salesFunnelCampaigns", campaign.brandId] });
    },
  });
  // The typed value shows while it saves (never the old one).
  const shown = save.isPending && save.variables !== undefined ? (save.variables ?? "") : served;
  const box = "w-full rounded-[8px] px-2 py-1.5 text-left text-[13px] leading-5 whitespace-pre-wrap";

  const commit = () => {
    if (text === null) return;
    if (dropped.current) {
      dropped.current = false;
      setText(null);
      return;
    }
    const next = text.trim() === "" ? null : text.trim();
    setText(null);
    if (next === (campaign.brief ?? null)) return;
    setError(null);
    save.mutate(next, {
      onError: (err) => {
        console.error("[campaign-brief] brief save failed", { campaignId: campaign.id, err });
        // Reopen with the text kept.
        setText(next ?? "");
        setError("Not saved. Try again.");
      },
    });
  };

  if (text !== null) {
    return (
      <>
        <textarea
          autoFocus
          aria-label="Brief"
          value={text}
          rows={Math.max(3, text.split("\n").length)}
          maxLength={8000}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              dropped.current = true;
              setError(null);
              e.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          className={`k-input ${box} resize-y`}
          // keel.css is unlayered: the box's padding, height and font ride inline so the field opens in the text's own box.
          style={{ font: "inherit", fontSize: 13, lineHeight: "20px", height: "auto", padding: "6px 8px" }}
        />
        <p className="k-fg3 mt-1 text-[11px]">Enter saves, Shift+Enter for a new line, Esc drops.</p>
        {error && <p className="mt-1 text-[12px]" style={{ color: ROSE }}>{error}</p>}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          dropped.current = false;
          setText(shown);
        }}
        className={`k-hover cursor-text ${box}`}
        aria-label="Edit the brief"
      >
        {shown ? <span className={save.isPending ? "k-fg3" : "k-fg"}>{shown}</span> : <span className="k-fg4">{emptyText}</span>}
      </button>
      {updatedNote && campaign.briefUpdatedAt && !save.isPending && <p className="k-fg3 mt-0.5 px-2 text-[11px]">{updatedNote(campaign.briefUpdatedAt)}</p>}
      {error && <p className="mt-1 px-2 text-[12px]" style={{ color: ROSE }}>{error}</p>}
    </>
  );
}
