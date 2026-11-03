"use client";

import { CustomerSuccessView } from "@/components/customer-success-view";

export default function CustomerSuccessPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Customer Success</h1>
        <p className="mt-1 text-sm text-gray-500">
          One row per ever-active customer (org and brand), currently-active first, with a
          green / yellow / red health badge and value economics. Green means active with
          audience runway; yellow flags a near-exhausted audience or a weak verdict from the
          backend; red means not active. Every number is computed and owned by the backend.
        </p>
      </div>

      <CustomerSuccessView />
    </div>
  );
}
