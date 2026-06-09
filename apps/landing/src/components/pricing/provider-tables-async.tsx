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
          <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--v2-surface-hi)] text-sm font-bold uppercase text-[var(--v2-sub)]">
            {group.provider[0]}
          </div>
        )}
        <h2 className="v2-h2 text-2xl capitalize">
          {group.provider}
        </h2>
      </div>
      <div className="v2-card overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--v2-border)]">
          <thead>
            <tr>
              <th className="v2-mono px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--v2-muted)]">
                Cost Type
              </th>
              <th className="v2-mono px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--v2-muted)]">
                Unit
              </th>
              <th className="v2-mono px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--v2-muted)]">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--v2-border)]">
            {group.rows.map((row) => (
              <tr key={row.name} className="hover:bg-[var(--v2-surface-hi)]">
                <td className="px-4 py-3 text-sm text-[var(--v2-text)]">{row.type}</td>
                <td className="px-4 py-3 text-sm text-[var(--v2-sub)]">per {row.unit}</td>
                <td className="v2-mono px-4 py-3 text-right text-sm font-medium text-[var(--v2-text)] tabular-nums">
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
    <div className="rounded-xl border border-[var(--v2-red-brd)] bg-[var(--v2-red-dim)] p-6 text-sm text-[var(--v2-text)]">
      <p className="font-semibold mb-1">Unable to load pricing.</p>
      <p className="v2-body mb-3">
        We were unable to fetch live unit costs from our costs service. Please try again
        in a few minutes, or contact support if this persists.
      </p>
      <pre className="overflow-x-auto rounded bg-[var(--v2-surface)] p-3 text-xs text-[var(--v2-red)]">
        {message}
      </pre>
    </div>
  );
}
