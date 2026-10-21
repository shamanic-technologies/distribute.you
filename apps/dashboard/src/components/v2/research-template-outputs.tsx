"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getTemplateOutputs, type TemplateOutput } from "@/lib/api";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { instantText } from "@/components/v2/research-bits";
import { templateContentKey, type ResearchTemplate } from "@/lib/research/research";

/**
 * The Templates page's right panel, open from the start (owner 2026-10-19): the selected
 * template's figures, then the 5 latest outputs written with it, every client, newest first
 * (content-generation-service; subject and each email as sent, never a client or a lead).
 */
export function TemplateOutputsPanel({ t, href, outcomeNoun }: { t: ResearchTemplate; href: string; outcomeNoun: string }) {
  // A dynasty row reads its head version's outputs (content generation keys outputs by version).
  const outputsKey = templateContentKey(t);
  const q = useAuthQuery(["templateOutputs", outputsKey], () => getTemplateOutputs(outputsKey, 5), { ...pollOptions, retry: false });
  const answered = q.data !== undefined || q.isFetchedAfterMount;
  return (
    <aside className="k-card flex h-fit min-h-0 flex-col self-start overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)]">
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        <p className="k-label">Last 5 emails written</p>
        <Link href={href} className="mt-1 block truncate text-[14px] font-medium hover:text-[var(--accent)]" title={t.label}>
          {t.label}
        </Link>
        <dl className="mt-2 grid grid-cols-4 gap-2 text-[12px]">
          <Fig k={`Cost / ${outcomeNoun.toLowerCase()}`} v={t.cost} />
          <Fig k="Rate" v={t.rate} />
          <Fig k="Emails" v={t.emails} />
          <Fig k="Invested" v={t.spend} />
        </dl>
      </div>
      <div className="k-scroll min-h-0 flex-1 overflow-y-auto">
        {!answered ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Shimmer key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : q.data === undefined ? (
          <EmptyNote>We could not read its last emails just now. It retries on its own.</EmptyNote>
        ) : q.data.length === 0 ? (
          <EmptyNote>Nothing written with this template is on record.</EmptyNote>
        ) : (
          <ol className="divide-y divide-[var(--line-subtle)]">
            {q.data.map((o) => (
              <OutputItem key={o.generationId} o={o} />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function Fig({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="k-label truncate">{k}</dt>
      <dd className="mt-0.5 truncate tabular-nums">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}

function OutputItem({ o }: { o: TemplateOutput }) {
  const [open, setOpen] = useState(false);
  const first = o.emails[0] ?? null;
  const rest = o.emails.slice(1);
  return (
    <li className="px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="k-mono k-fg3 shrink-0 text-[11.5px]">{instantText(o.createdAt)}</span>
        <span className="k-chip ml-auto min-w-0 truncate" title={o.model}>
          {o.model}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium leading-5">{o.subject ?? <span className="k-fg4">No subject</span>}</p>
      {first ? (
        <p className={`k-fg2 mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-[19px] ${open ? "" : "line-clamp-6"}`}>{first.bodyText}</p>
      ) : (
        <p className="k-fg3 mt-1 text-[12px]">No copy stored for this one.</p>
      )}
      {open &&
        rest.map((e) => (
          <div key={e.step} className="mt-3">
            <p className="k-label">
              Follow-up {e.step - 1}
              {e.daysSinceLastStep != null ? `, ${e.daysSinceLastStep} ${e.daysSinceLastStep === 1 ? "day" : "days"} later` : ""}
            </p>
            <p className="k-fg2 mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-[19px]">{e.bodyText}</p>
          </div>
        ))}
      {first && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="k-btn-ghost mt-1.5 h-6 px-1.5 text-[12px]">
          {open ? "Show less" : rest.length ? `Show all and ${rest.length} ${rest.length === 1 ? "follow-up" : "follow-ups"}` : "Show all"}
        </button>
      )}
    </li>
  );
}
