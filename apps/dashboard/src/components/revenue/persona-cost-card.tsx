"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listPersonas } from "@/lib/api";
import { personaMockCost } from "@/lib/mock-personas";
import { MaturityBadge } from "@/components/maturity-badge";

/**
 * Signups "Cost by persona" card. Persona NAMES are real (brand-service via the
 * personas page); the CPC + cost-per-signup numbers are still deterministic
 * placeholders (`personaMockCost`) until real per-persona attribution lands
 * (features-service FR #298). Shows the brand's non-archived personas.
 */
export function PersonaCostCard() {
  const params = useParams();
  const brandId = params.brandId as string;
  const { data } = useAuthQuery(["personas", brandId], () => listPersonas(brandId));
  const rows = (data?.personas ?? [])
    .filter((p) => p.status !== "archived")
    .map((p) => ({ persona: p, ...personaMockCost(p.id) }));

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
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-xs text-gray-400">No personas yet.</td>
              </tr>
            )}
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
