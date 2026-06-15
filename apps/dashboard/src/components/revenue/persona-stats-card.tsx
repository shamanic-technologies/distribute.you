"use client";

import { SEED_PERSONAS, personaMockCost } from "@/lib/mock-personas";
import { MaturityBadge } from "@/components/maturity-badge";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usd2 = (n: number) => `$${n.toFixed(2)}`;
const num = (n: number) => n.toLocaleString("en-US");

/**
 * Stats by Customer Persona — PURE MOCKUP. Per-persona signups breakdown
 * (Clicks · Signups · Cost per signup · Expected revenue). Numbers are
 * deterministic placeholders (`personaMockCost`) until the backend attributes
 * real spend + conversions per persona. Names come from the shared seed list.
 */
export function PersonaStatsCard() {
  const rows = SEED_PERSONAS.map((p) => ({ persona: p, ...personaMockCost(p.id) }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Stats by Customer Persona</h3>
        <MaturityBadge level="beta" />
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        Signups performance broken down by customer persona.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="font-medium pb-2 pr-4">Persona</th>
              <th className="font-medium pb-2 px-4 text-right whitespace-nowrap">Clicks</th>
              <th className="font-medium pb-2 px-4 text-right whitespace-nowrap">Signups</th>
              <th className="font-medium pb-2 px-4 text-right whitespace-nowrap">CPC</th>
              <th className="font-medium pb-2 px-4 text-right whitespace-nowrap">Cost / signup</th>
              <th className="font-medium pb-2 pl-4 text-right whitespace-nowrap">Signup revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ persona, clicks, signups, cpcUsd, costPerSignupUsd, expectedRevenueUsd }) => (
              <tr key={persona.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-gray-900">{persona.name}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">{num(clicks)}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">{num(signups)}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 whitespace-nowrap">{usd2(cpcUsd)}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 whitespace-nowrap">{usd2(costPerSignupUsd)}</td>
                <td className="py-2.5 pl-4 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">{usd(expectedRevenueUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
