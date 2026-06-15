"use client";

import { SEED_PERSONAS, personaMockCost } from "@/lib/mock-personas";
import { MaturityBadge } from "@/components/maturity-badge";

/**
 * Signups "Cost by persona" card — PURE MOCKUP. Lists each Customer Persona
 * with its CPC and cost per signup. Numbers are deterministic placeholders
 * (`personaMockCost`); real per-persona attribution needs the backend data
 * layer. Names come from the shared seed list so they match the Personas page.
 */
export function PersonaCostCard() {
  const rows = SEED_PERSONAS.map((p) => ({ persona: p, ...personaMockCost(p.id) }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Cost by persona</h3>
        <MaturityBadge level="beta" />
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        CPC and cost per signup for each customer persona.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="font-medium pb-2 pr-4">Persona</th>
              <th className="font-medium pb-2 px-4 text-right whitespace-nowrap">CPC</th>
              <th className="font-medium pb-2 pl-4 text-right whitespace-nowrap">Cost per signup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ persona, cpcUsd, costPerSignupUsd }) => (
              <tr key={persona.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-gray-900">{persona.name}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 whitespace-nowrap">
                  ${cpcUsd.toFixed(2)}
                </td>
                <td className="py-2.5 pl-4 text-right tabular-nums text-gray-700 whitespace-nowrap">
                  ${costPerSignupUsd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
