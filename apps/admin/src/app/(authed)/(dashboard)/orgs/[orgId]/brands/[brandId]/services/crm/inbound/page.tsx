"use client";

import { Fragment, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { listMatrixLeads, listMatrixConnections, type MatrixLead } from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";
import {
  channelLabel,
  channelRows,
  conversationsReadLabel,
  estimatedValueLabel,
  leadContactLabel,
  leadStatusLabel,
  leadStatusTone,
  noChannelSyncing,
} from "@/lib/matrix-inbound";

// Brand-level CRM "Inbound DMs" page: the people who wrote to this brand first,
// over WhatsApp / Telegram / Discord, bridged into crm-service over Matrix.
//
// Two questions on one screen, in this order:
//   1. the LEADS: one row per conversation, with the LLM's status / next step /
//      estimated value. This is why the page exists, so it leads.
//   2. the CONNECTION HEALTH: which bridges are actually logged in and syncing.
//      A lead table that silently stops updating because a bridge logged out is
//      worse than no table, so the state sits on the same screen.
//
// The two reads are SEPARATE queries with SEPARATE reveal gates: a failing
// connections read must never hold the leads table in a skeleton, and neither
// may skeleton forever: each gate settles on error as well as on data.

const TONE_CLASSES: Record<string, string> = {
  // Every tint is in the `html.dark` remapped closed set (globals.css).
  gray: "bg-gray-50 text-gray-600 border-gray-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
  red: "bg-red-50 text-red-700 border-red-200",
};

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full border ${TONE_CLASSES[tone] ?? TONE_CLASSES.gray}`}
    >
      {children}
    </span>
  );
}

/** Absolute, because every timestamp here is read next to another timestamp. */
function whenLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-10 bg-gray-100 border-b border-gray-100" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 border-b border-gray-50 last:border-b-0" />
      ))}
    </div>
  );
}

function LeadDetail({ lead }: { lead: MatrixLead }) {
  const value = estimatedValueLabel(lead.estimatedValueUsd);
  const readAt = whenLabel(lead.computedAt);
  return (
    <div className="px-4 pb-4 -mt-1 text-sm">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-0.5">Summary</p>
          <p className="text-gray-700">{lead.summary}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-0.5">Next step</p>
          <p className="text-gray-700">{lead.nextStep}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 pt-1">
          <span>
            Estimated value:{" "}
            <span className="text-gray-700">{value ?? "Not stated"}</span>
          </span>
          <span>
            Messages:{" "}
            <span className="text-gray-700">
              {lead.inboundCount.toLocaleString("en-US")} in,{" "}
              {lead.outboundCount.toLocaleString("en-US")} out
            </span>
          </span>
          {lead.channelHandle && <span>Handle: <span className="text-gray-700">{lead.channelHandle}</span></span>}
          {lead.phoneE164 && <span>Phone: <span className="text-gray-700">{lead.phoneE164}</span></span>}
          {readAt && <span>Read by {lead.model} on {readAt}</span>}
        </div>
      </div>
    </div>
  );
}

export default function InboundDmsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [search, setSearch] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const {
    data: leadsData,
    isPending: leadsPending,
    isError: leadsError,
    error: leadsErrorValue,
  } = useAuthQuery(["matrixLeads", brandId], () => listMatrixLeads(brandId), pollOptions);

  const {
    data: connectionsData,
    isPending: connectionsPending,
    isError: connectionsError,
  } = useAuthQuery(
    ["matrixConnections", brandId],
    () => listMatrixConnections(brandId),
    pollOptions,
  );

  // Reveal on SETTLE, per card. `isPending` alone skeletons forever when the
  // read fails; each card also carries its own gate so one failing read cannot
  // hold the other in a skeleton.
  const leadsSettled = !leadsPending || leadsError;
  const connectionsSettled = !connectionsPending || connectionsError;

  const leads = leadsData?.leads;
  const connections = connectionsData?.connections;

  const filtered = useMemo(() => {
    if (!leads) return [];
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        leadContactLabel(l).toLowerCase().includes(q)
        || l.summary.toLowerCase().includes(q)
        || l.nextStep.toLowerCase().includes(q)
        || channelLabel(l.channel).toLowerCase().includes(q)
        || leadStatusLabel(l.status).toLowerCase().includes(q),
    );
  }, [leads, search]);

  const rows = connections ? channelRows(connections) : [];
  const nothingSyncing = connections ? noChannelSyncing(connections) : false;

  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-gray-800">
          Inbound DMs
          {leads && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({conversationsReadLabel(leads.length)})
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          People who wrote to this brand first, over WhatsApp, Telegram and Discord.
        </p>
      </div>

      {/* ── Leads ───────────────────────────────────────────────────────── */}
      {!leadsSettled ? (
        <TableSkeleton />
      ) : leadsError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h3 className="font-display font-bold text-gray-800 mb-1">
            Could not read the inbound leads
          </h3>
          <p className="text-sm text-gray-600">
            {leadsErrorValue?.message ?? "The request failed with no detail."}
          </p>
        </div>
      ) : leads && leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
            No inbound conversations yet
          </h3>
          <p className="text-gray-600 text-sm max-w-lg mx-auto">
            {nothingSyncing
              ? "No bridge is syncing yet, so nothing has arrived. Log a channel in below and messages start landing here."
              : "Nothing has been read into a lead yet. Conversations appear here once someone writes in."}
          </p>
        </div>
      ) : leads ? (
        <>
          <EntitySearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by contact, channel, status, or what the thread says..."
            resultCount={filtered.length}
            totalCount={leads.length}
          />
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No conversations match your search.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm md:min-w-[820px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Next step</th>
                    <th className="px-4 py-3 hidden md:table-cell">Value</th>
                    <th className="px-4 py-3 hidden md:table-cell">Last message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((lead) => {
                    const open = openLeadId === lead.id;
                    const value = estimatedValueLabel(lead.estimatedValueUsd);
                    // The date beside the counters is the conversation's own; the
                    // reading's date sits with the reading, in the detail panel.
                    const lastMessage = whenLabel(lead.lastMessageAt);
                    return (
                      <Fragment key={lead.id}>
                        <tr
                          onClick={() => setOpenLeadId(open ? null : lead.id)}
                          className="hover:bg-gray-50 transition cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-800 truncate max-w-[220px] block">
                              {leadContactLabel(lead)}
                            </span>
                            <span className="text-xs text-gray-500 sm:hidden">
                              {channelLabel(lead.channel)}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                            {channelLabel(lead.channel)}
                          </td>
                          <td className="px-4 py-3">
                            <Pill tone={leadStatusTone(lead.status)}>
                              {leadStatusLabel(lead.status)}
                            </Pill>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-gray-600 truncate max-w-[280px] block">
                              {lead.nextStep}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={value ? "text-gray-800" : "text-gray-400"}>
                              {value ?? "Not stated"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600 whitespace-nowrap">
                            {lastMessage ?? "Unknown"}
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <LeadDetail lead={lead} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {/* ── Connection health ───────────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="font-display text-base font-bold text-gray-800 mb-1">Channels</h2>
        <p className="text-sm text-gray-500 mb-3">
          Nothing new reaches the table above while a channel is not syncing.
        </p>

        {!connectionsSettled ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 h-24 animate-pulse"
              />
            ))}
          </div>
        ) : connectionsError ? (
          <div className="bg-white rounded-xl border border-red-200 p-6">
            <p className="text-sm text-gray-600">
              Could not read the channel connections, so the state of the bridges is
              unknown right now. The leads above may be stale.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {rows.map((row) => {
              const syncedAt = whenLabel(row.connection?.lastSyncedAt ?? null);
              return (
                <div key={row.channel} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-gray-800">{row.label}</span>
                    <Pill tone={row.state.tone}>{row.state.label}</Pill>
                  </div>
                  <p className="text-xs text-gray-500">{row.state.detail}</p>
                  {/* The sync time states what happened, so it renders only when a
                      sync has happened. */}
                  {syncedAt && (
                    <p className="text-xs text-gray-500 mt-1">Last synced {syncedAt}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
