import Image from "next/image";
import {
  fetchPlatformPrices,
  groupByProvider,
  formatPrice,
  type ProviderGroup,
} from "@/lib/pricing/fetch-prices";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

export async function ProviderTablesAsync() {
  let groups: ProviderGroup[] | null = null;
  let fetchError: string | null = null;
  try {
    const rows = await fetchPlatformPrices("");
    groups = groupByProvider(rows);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    console.error("[landing] Pricing page fetch failed:", fetchError);
  }

  if (fetchError) {
    return <ErrorState message={fetchError} />;
  }
  if (!groups || groups.length === 0) {
    return (
      <ErrorState message="No unit costs returned by costs-service. This usually means the catalog is empty." />
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <ProviderSection key={group.provider} group={group} />
      ))}
    </div>
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
