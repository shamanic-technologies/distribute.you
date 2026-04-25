"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import { transferBrand } from "@/lib/api";

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
          {/* Transfer Brand */}
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
    </div>
  );
}
