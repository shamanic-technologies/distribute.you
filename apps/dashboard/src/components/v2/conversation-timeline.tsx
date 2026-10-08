"use client";

import { friendlyDateTime } from "@/lib/friendly-datetime";
import {
  conversationItemTag,
  conversationSourceWord,
  furthestStepTag,
  lastWordTag,
  liveItems,
  type ConversationTimeline,
} from "@/lib/conversation-timeline";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { TagChip } from "@/components/v2/tag-chip";

/**
 * The conversation's own tags (lead-service's, owner 2026-10-08): its last word and how far it
 * went, with "Not ours" when the fact that took it there is not our doing (an existing client).
 */
export function ConversationTags({ tags }: { tags: ConversationTimeline["tags"] }) {
  const step = furthestStepTag(tags.furthestStep);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="k-label">Last word</span>
        <TagChip tag={lastWordTag(tags.lastWord)} />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="k-label">Furthest step</span>
        {step ? <TagChip tag={step} /> : <span className="k-fg4">{"—"}</span>}
        {step && tags.furthestStepAttributable === false ? <span className="k-fg3">Not ours</span> : null}
      </span>
    </div>
  );
}

/**
 * One conversation on the person page: its tags, then every stored fact oldest first, each
 * with lead-service's label. Withdrawn facts are kept by lead-service and left out here.
 */
export function ConversationTimelineCard({
  timeline,
  failed,
}: {
  timeline: ConversationTimeline | null;
  failed: boolean;
}) {
  return (
    <section className="k-card overflow-hidden">
      <header className="k-line-subtle flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <span className="k-label">Timeline</span>
        {timeline ? <ConversationTags tags={timeline.tags} /> : null}
      </header>
      {timeline ? (
        <TimelineRows timeline={timeline} />
      ) : failed ? (
        <EmptyNote>We could not read this conversation right now. Retrying.</EmptyNote>
      ) : (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
    </section>
  );
}

function TimelineRows({ timeline }: { timeline: ConversationTimeline }) {
  const items = liveItems(timeline);
  if (items.length === 0) return <EmptyNote>Nothing has happened in this conversation yet.</EmptyNote>;
  return (
    <ol>
      {items.map((it) => (
        <li key={it.id} className="k-line-subtle flex min-w-0 items-center gap-2 border-b px-4 py-2.5 text-[12px] last:border-b-0">
          <TagChip tag={conversationItemTag(it.label)} />
          <span className="k-fg2 truncate">{conversationSourceWord(it.source)}</span>
          {it.attributable === false ? <span className="k-fg3 shrink-0">Not ours</span> : null}
          {it.url ? (
            <a href={it.url} target="_blank" rel="noopener noreferrer" className="k-fg3 min-w-0 truncate hover:underline">
              {it.url}
            </a>
          ) : null}
          <span className="k-mono k-fg2 ml-auto shrink-0 text-[12px]">{it.occurredAt ? friendlyDateTime(it.occurredAt) : "No date"}</span>
        </li>
      ))}
    </ol>
  );
}
