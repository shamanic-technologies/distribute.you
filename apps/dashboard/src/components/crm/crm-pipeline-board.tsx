"use client";

import { formatAmount, type CrmOpportunity, type CrmPipelineRead } from "@/lib/crm-view";

/**
 * The client's own sales pipeline, laid out the way their own system lays it out.
 *
 * The GROUPING, the stage ORDER, the per-stage `count` and `totalValue` are all
 * crm-service's — this renders them and computes none of them. Regrouping a flat
 * list here, or counting the cards on screen, would be a second answer to a
 * question the producer already answered.
 *
 * READ-ONLY, and structurally so: no service between here and their CRM has a
 * write path to it, so a card is a thing to look at and never a thing to drag.
 * The board on the Leads page moves cards because WE own that standing; this one
 * shows somebody else's, and moving it would state a change their system never
 * made.
 */
export function CrmPipelineBoard({ view }: { view: CrmPipelineRead }) {
  if (view.totalOpportunities === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">No deals in your pipeline yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {view.pipelines.map((pipeline) => (
        <section key={pipeline.id}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-medium text-gray-900">{pipeline.name}</h3>
            <span className="text-xs text-gray-500">
              {pipeline.count} {pipeline.count === 1 ? "deal" : "deals"}
              {formatAmount(pipeline.totalValue) ? ` · ${formatAmount(pipeline.totalValue)}` : ""}
            </span>
          </div>

          {/* The rail scrolls rather than crushing its columns: how many stages a
              pipeline has is the client's decision, not something a breakpoint
              can know. Columns share the width and fall back to a floor. */}
          <div className="-m-1 flex gap-3 overflow-x-auto p-1">
            {pipeline.stages.map((stage) => (
              <div
                key={stage.id}
                className="flex min-w-[13rem] flex-1 basis-0 flex-col rounded-xl border border-gray-200 bg-gray-50"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-gray-200 px-3 py-2">
                  <span className="truncate text-xs font-medium text-gray-700">
                    {(stage.name ?? "").trim() || "Unnamed stage"}
                  </span>
                  {/* Served by crm-service, not a count of the cards below. */}
                  <span className="shrink-0 text-xs text-gray-400">{stage.count}</span>
                </div>

                <div className="space-y-2 p-2">
                  {stage.opportunities.map((o) => (
                    <DealCard key={o.id} deal={o} />
                  ))}
                  {stage.opportunities.length === 0 ? (
                    <p className="px-1 py-2 text-[11px] text-gray-400">Nothing here</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Deals their system put in a pipeline we have not mirrored. Shown rather
          than dropped, so the counts on this page add up to what they see in
          their own CRM. */}
      {view.ungrouped.length > 0 ? (
        <section>
          <h3 className="mb-1 text-sm font-medium text-gray-900">Not in a pipeline</h3>
          <p className="mb-3 text-xs text-gray-500">
            These deals are in your CRM but not in one of the pipelines above.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {view.ungrouped.map((o) => (
              <DealCard key={o.id} deal={o} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DealCard({ deal }: { deal: CrmOpportunity }) {
  const amount = formatAmount(deal.monetaryValue);
  const who = (deal.contactName ?? "").trim();
  const title = deal.name.trim() || who || "Untitled deal";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="truncate text-xs font-medium text-gray-900">{title}</div>
      {who && title !== who ? (
        <div className="mt-0.5 truncate text-[11px] text-gray-500">{who}</div>
      ) : null}
      {amount ? <div className="mt-1 text-[11px] font-medium text-gray-700">{amount}</div> : null}
    </div>
  );
}
