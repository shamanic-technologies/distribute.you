"use client";

import { useState } from "react";
import { useQueryClient } from "@/lib/use-auth-query";
import { markAnsweredOutside } from "@/lib/api";

/**
 * "I answered them outside the platform" (owner 2026-10-11): an answer sent from a mailbox
 * we do not read (a personal Gmail) is invisible to us, so the person states it here.
 * lead-service records it and takes them out of Needs your call until they write again.
 */
export function MarkAnswered({ leadRowId, brandId, small }: { leadRowId: string; brandId: string; small?: boolean }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const onClick = async () => {
    setState("saving");
    try {
      await markAnsweredOutside(leadRowId, brandId);
      await queryClient.invalidateQueries({ queryKey: ["awaitingReply", brandId] });
      setState("idle");
    } catch (error) {
      console.error("[dashboard] MarkAnswered: statement failed", { leadRowId, brandId, error });
      setState("failed");
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={state === "saving"}
        title="You answered them from your own mailbox"
        className={small ? "k-btn-ghost h-6 px-2 text-[12px]" : "k-btn-ghost"}
      >
        {state === "saving" ? "Saving…" : "Mark answered"}
      </button>
      {state === "failed" && <span className="text-[12px] text-[var(--data-rose)]">Could not save. Try again.</span>}
    </>
  );
}
