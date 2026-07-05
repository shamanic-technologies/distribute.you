"use client";

import { useState } from "react";
import type { GoogleContactRow } from "@/lib/api";
import { contactDisplay } from "./contact-display";
import { groupContactsByOrg } from "./group-contacts-by-org";

type Tab = "humans" | "organizations";

export function ContactsList({
  items,
  nextCursor,
  onLoadMore,
  loadingMore,
  loadMoreError,
}: {
  items: GoogleContactRow[];
  nextCursor: string | null;
  onLoadMore: () => void;
  loadingMore: boolean;
  loadMoreError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("humans");

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          No Google contacts yet. Click &quot;Sync now&quot; to import contacts.
        </p>
      </div>
    );
  }

  const groups = tab === "organizations" ? groupContactsByOrg(items) : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab("humans")}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
            tab === "humans"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Humans ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("organizations")}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
            tab === "organizations"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Organizations
        </button>
      </div>

      {tab === "humans" ? (
        <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {items.map((row, idx) => {
            const c = contactDisplay(row);
            const key = row.id ?? row.resourceName ?? `contact-${idx}`;
            return (
              <li key={key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {c.displayName ?? (
                        <span className="text-gray-400 italic">(no name)</span>
                      )}
                    </p>
                    {c.primaryEmail !== null && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {c.primaryEmail}
                      </p>
                    )}
                    {c.primaryPhone !== null && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {c.primaryPhone}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 max-w-[40%]">
                    {c.organizationName !== null && (
                      <p className="text-xs text-gray-700 truncate">
                        {c.organizationName}
                      </p>
                    )}
                    {c.organizationTitle !== null && (
                      <p className="text-xs text-gray-400 truncate">
                        {c.organizationTitle}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {groups!.map((g) => (
            <li key={g.orgName ?? "__no_org__"} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {g.orgName ?? (
                    <span className="text-gray-500 italic">No organization</span>
                  )}
                </p>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {g.contacts.length} contact{g.contacts.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="space-y-1 pl-3 border-l-2 border-gray-100">
                {g.contacts.map((row, idx) => {
                  const c = contactDisplay(row);
                  return (
                    <li
                      key={row.id ?? row.resourceName ?? `${g.orgName ?? "noorg"}-${idx}`}
                      className="text-xs text-gray-600 flex items-baseline justify-between gap-3"
                    >
                      <span className="truncate">
                        {c.displayName ?? "(no name)"}
                        {c.organizationTitle !== null && (
                          <span className="text-gray-400"> · {c.organizationTitle}</span>
                        )}
                      </span>
                      {c.primaryEmail !== null && (
                        <span className="text-gray-400 truncate flex-shrink-0 max-w-[50%]">
                          {c.primaryEmail}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {loadMoreError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {loadMoreError}
        </div>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
