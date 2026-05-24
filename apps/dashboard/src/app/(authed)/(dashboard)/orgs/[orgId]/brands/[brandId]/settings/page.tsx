"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import {
  transferBrand,
  listOutgoingTransfers,
  listIncomingTransfers,
  type BrandTransfer,
} from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";

export default function BrandSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;

  const { organization } = useOrganization();
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<BrandTransfer | null>(null);

  const { data: outgoingData, isLoading: outgoingLoading } = useAuthQuery(
    ["brand-transfers-outgoing", brandId],
    () => listOutgoingTransfers(brandId),
  );
  const { data: incomingData, isLoading: incomingLoading } = useAuthQuery(
    ["brand-transfers-incoming", brandId],
    () => listIncomingTransfers(brandId),
  );

  const outgoing = outgoingData?.transfers ?? [];
  const incoming = incomingData?.transfers ?? [];
  const transfersLoading = outgoingLoading || incomingLoading;

  const otherOrgs = (userMemberships.data ?? [])
    .map((m) => m.organization)
    .filter((org) => org.id !== orgId);

  const selectedOrgName = otherOrgs.find((o) => o.id === selectedOrgId)?.name ?? "";

  const handleTransfer = async () => {
    if (!selectedOrgId || transferring) return;
    setTransferring(true);
    setError(null);
    try {
      await transferBrand(brandId, selectedOrgId);
      router.push(`/orgs/${orgId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Brand Settings</h1>

      {/* Danger Zone */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Danger Zone</h2>
        <div className="border border-red-300 rounded-lg divide-y divide-red-300">
          <div className="flex items-center justify-between p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Transfer brand</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Transfer this brand to another organization you are a member of.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Select organization...</option>
                {otherOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedOrgId || transferring}
                className="px-4 py-1.5 text-sm font-medium rounded-md border border-red-600 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-red-600 transition"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Transfer History */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Transfer History</h2>
        {transfersLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : outgoing.length === 0 && incoming.length === 0 ? (
          <p className="text-sm text-gray-500">No transfers yet.</p>
        ) : (
          <div className="space-y-6">
            {outgoing.length > 0 && (
              <TransferList
                label="Outgoing"
                transfers={outgoing}
                onSelect={setSelectedTransfer}
              />
            )}
            {incoming.length > 0 && (
              <TransferList
                label="Incoming"
                transfers={incoming}
                onSelect={setSelectedTransfer}
              />
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => !transferring && setConfirmOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Transfer brand?</h3>
              <p className="text-sm text-gray-600 mb-1">
                This will transfer the brand from{" "}
                <span className="font-medium text-gray-900">{organization?.name ?? "this organization"}</span>{" "}
                to{" "}
                <span className="font-medium text-gray-900">{selectedOrgName}</span>.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                All campaigns, runs, and associated data will move with the brand. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={transferring}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={transferring}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {transferring ? "Transferring..." : "Transfer brand"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transfer Detail Panel */}
      {selectedTransfer && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedTransfer(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Transfer Details</h3>
                <button
                  onClick={() => setSelectedTransfer(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedTransfer.createdAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Source Org</p>
                  <p className="text-sm text-gray-900 font-mono">{selectedTransfer.sourceOrgId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Target Org</p>
                  <p className="text-sm text-gray-900 font-mono">{selectedTransfer.targetOrgId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Initiated By</p>
                  <p className="text-sm text-gray-900 font-mono">{selectedTransfer.initiatedByUserId}</p>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-gray-900 mb-3">Service Results</h4>
              <div className="space-y-2">
                {Object.entries(selectedTransfer.serviceResults).map(([service, result]) => (
                  <div key={service} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{service}</span>
                      {"error" in result ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">failed</span>
                      ) : "skipped" in result ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">skipped</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">migrated</span>
                      )}
                    </div>
                    {"error" in result && (
                      <p className="text-xs text-red-600 mt-1">{result.error}</p>
                    )}
                    {"updatedTables" in result && result.updatedTables.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {result.updatedTables.map((t) => (
                          <div key={t.tableName} className="flex justify-between text-xs text-gray-600">
                            <span className="font-mono">{t.tableName}</span>
                            <span>{t.count} row{t.count !== 1 ? "s" : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TransferList({
  label,
  transfers,
  onSelect,
}: {
  label: string;
  transfers: BrandTransfer[];
  onSelect: (t: BrandTransfer) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-600 mb-2">{label}</h3>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
        {transfers.map((t) => {
          const entries = Object.entries(t.serviceResults);
          const errorCount = entries.filter(([, r]) => "error" in r).length;
          const successCount = entries.filter(([, r]) => "updatedTables" in r).length;
          const skippedCount = entries.filter(([, r]) => "skipped" in r).length;

          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full text-left p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(t.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">
                    {t.sourceOrgId.slice(0, 8)} → {t.targetOrgId.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {successCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {successCount} migrated
                    </span>
                  )}
                  {skippedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {skippedCount} skipped
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {errorCount} failed
                    </span>
                  )}
                  <span className="text-gray-400 ml-1">→</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
