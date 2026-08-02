"use client";

import { InvestorListView } from "@/components/investors/investor-list-view";

export default function InvestorListPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Investor list</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everyone who receives an investor update. Paste addresses in any shape you have them:
          one per line, comma-separated, or as name and address pairs. Pasting the same batch
          twice is safe. Someone who opts out stays on the list, marked, and is skipped on the
          next send.
        </p>
      </div>

      <InvestorListView />
    </div>
  );
}
