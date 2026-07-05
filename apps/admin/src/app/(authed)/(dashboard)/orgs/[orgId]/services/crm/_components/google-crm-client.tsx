"use client";

import { useEffect, useRef } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { listGoogleAccounts } from "@/lib/api";
import { ConnectGoogleButton } from "./connect-google-button";
import { SyncNowButton } from "./sync-now-button";
import { CrmWorkspace } from "./crm-workspace";
import { useGoogleSync } from "./use-google-sync";

/**
 * Google CRM shell: connect / accounts / background-sync, then the contacts CRM
 * workspace (filterable table + detail panel with the org/brand/feature status
 * editor and the per-contact Gmail thread). Accounts are persisted (config-like);
 * the contacts list + per-contact thread are in-memory SWR owned by CrmWorkspace.
 */
export function GoogleCrmClient() {
  const accountsQuery = useAuthQuery(
    ["googleAccounts"],
    () => listGoogleAccounts(),
    pollOptionsSlower,
  );
  const accounts = accountsQuery.data ?? [];
  const isConnected = accounts.length > 0;

  const { runSync } = useGoogleSync();

  // Revalidate-on-open: fire ONE silent background sync the first time we know the
  // org is connected, then invalidate the CRM queries (handled inside runSync).
  const syncedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !syncedRef.current) {
      syncedRef.current = true;
      void runSync({ silent: true });
    }
  }, [isConnected, runSync]);

  const accountsReady = !accountsQuery.isPending;

  if (!accountsReady) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
          <Skeleton className="h-5 w-40 mb-3" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-medium text-gray-900 mb-1">Connect your Google account</h2>
        <p className="text-sm text-gray-500 mb-4">
          Authorize Distribute to read your Gmail messages and Google Contacts.
        </p>
        <ConnectGoogleButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accounts card — static frame + labels paint immediately (accounts are known here) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-medium text-gray-900 mb-1">Connected accounts</h2>
            <ul className="space-y-1">
              {accounts.map((acc, idx) => (
                <li key={acc.email ?? `account-${idx}`} className="text-sm text-gray-700">
                  {acc.email !== undefined ? (
                    <code className="font-mono text-xs">{acc.email}</code>
                  ) : (
                    <span className="text-red-600 text-xs">Account {idx} missing email field</span>
                  )}
                  {acc.status !== undefined && (
                    <span className="ml-2 text-xs text-gray-500">{acc.status}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <SyncNowButton />
        </div>
      </div>

      <CrmWorkspace />
    </div>
  );
}
