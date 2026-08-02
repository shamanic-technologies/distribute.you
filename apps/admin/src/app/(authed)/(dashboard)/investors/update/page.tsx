"use client";

import { InvestorUpdateComposer } from "@/components/investors/investor-update-composer";

export default function InvestorUpdatePage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Investor update</h1>
        <p className="mt-1 text-sm text-gray-500">
          Write an update and send it to everyone on the investor list, from kevin@distribute.you.
          Each person gets their own copy, so no recipient sees another, and each carries a
          discreet unsubscribe. Preview it before you send.
        </p>
      </div>

      <InvestorUpdateComposer />
    </div>
  );
}
