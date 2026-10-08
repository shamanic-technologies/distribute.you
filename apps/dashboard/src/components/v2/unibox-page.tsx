"use client";

import { useParams } from "next/navigation";
import { TopBar } from "@/components/v2/ui";
import { V2ConversationsView } from "@/components/v2/integrations-conversations";

/**
 * Unibox (staff mode, owner 2026-10-08): everyone the brand is talking to, on every
 * channel, one thread per person. Under Records in the sidebar; it was Integrations >
 * Conversations, whose URL now redirects here.
 */
export function UniboxPage() {
  const { brandId = "" } = useParams<{ brandId?: string }>();
  // On desktop the page fills the panel exactly: only the people list and the thread
  // scroll, never the page itself (owner 2026-10-08). Phones keep the stacked page.
  return (
    <div className="lg:flex lg:h-full lg:flex-col">
      <TopBar crumbs={[{ label: "Records" }, { label: "Unibox" }]} />
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 md:px-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pb-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">Unibox</h1>
        <p className="k-fg2 mb-6 mt-1 text-[14px]">Everyone you are talking to, on every channel, in one thread.</p>
        <V2ConversationsView brandId={brandId} />
      </div>
    </div>
  );
}
