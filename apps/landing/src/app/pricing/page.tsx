import Image from "next/image";
import { headers } from "next/headers";
import {
  fetchPlatformPrices,
  groupByProvider,
  formatPrice,
  type ProviderGroup,
} from "@/lib/pricing/fetch-prices";

export const revalidate = 300;

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

export default async function PricingPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  let groups: ProviderGroup[] | null = null;
  let fetchError: string | null = null;
  try {
    const rows = await fetchPlatformPrices(host);
    groups = groupByProvider(rows);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    console.error("[landing] Pricing page fetch failed:", fetchError);
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="py-16 md:py-20 px-4 gradient-bg">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-emerald-200">
            Transparent variable costs
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
            Every unit cost we re-bill,{" "}
            <span className="gradient-text">live from production</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-2">
            We do not sell flat subscriptions. You pay only for what your campaigns
            actually consume — token by token, lead by lead, email by email.
          </p>
          <p className="text-sm text-gray-500 max-w-2xl mx-auto">
            Below is the live unit-cost catalog grouped by provider. Prices change as
            providers change theirs.
          </p>
        </div>
      </section>

      {/* 3-layer pricing stack */}
      <section className="py-12 px-4 border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs uppercase tracking-wider text-gray-400 font-medium mb-6">
            How pricing works
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
                Layer 1
              </div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
                Primitives
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                50+ priced API operations. Each one listed below.
                Fixed unit price per call.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
                Layer 2
              </div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
                Workflows
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Recipes that combine primitives. One run = sum of primitives.
                Forkable, customizable.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
                Layer 3
              </div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
                Outcomes
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Derived a posteriori. $/qualified reply, $/paid conversion —
                your real CAC, tracked per product × channel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          {fetchError ? (
            <ErrorState message={fetchError} />
          ) : groups && groups.length > 0 ? (
            <div className="space-y-10">
              {groups.map((group) => (
                <ProviderSection key={group.provider} group={group} />
              ))}
            </div>
          ) : (
            <ErrorState message="No unit costs returned by costs-service. This usually means the catalog is empty." />
          )}
        </div>
      </section>
    </main>
  );
}

function ProviderSection({ group }: { group: ProviderGroup }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        {group.providerDomain && LOGO_DEV_TOKEN ? (
          <Image
            src={`https://img.logo.dev/${group.providerDomain}?token=${LOGO_DEV_TOKEN}&size=64`}
            alt={group.provider}
            width={36}
            height={36}
            className="rounded"
            unoptimized
          />
        ) : (
          <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center text-gray-600 text-sm font-bold uppercase">
            {group.provider[0]}
          </div>
        )}
        <h2 className="font-display text-2xl font-semibold text-gray-900 capitalize">
          {group.provider}
        </h2>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {group.rows.map((row) => (
              <tr key={row.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{row.type}</td>
                <td className="px-4 py-3 text-sm text-gray-500">per {row.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right tabular-nums">
                  {formatPrice(row.pricePerUnitInUsdCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-sm text-red-800">
      <p className="font-semibold mb-1">Unable to load pricing.</p>
      <p className="text-red-700 mb-3">
        We were unable to fetch live unit costs from our costs service. Please try again
        in a few minutes, or contact support if this persists.
      </p>
      <pre className="bg-red-100 text-red-900 text-xs p-3 rounded overflow-x-auto">
        {message}
      </pre>
    </div>
  );
}
