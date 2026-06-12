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
          <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--dy-surface-hi)] text-sm font-bold uppercase text-[var(--dy-sub)]">
            {group.provider[0]}
          </div>
        )}
        <h2 className="dy-h2 text-2xl capitalize">
          {group.provider}
        </h2>
      </div>
      <div className="dy-card overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--dy-border)]">
          <thead>
            <tr>
              <th className="dy-mono px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">
                Cost Type
              </th>
              <th className="dy-mono px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">
                Unit
              </th>
              <th className="dy-mono px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--dy-muted)]">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--dy-border)]">
            {group.rows.map((row) => (
              <tr key={row.name} className="hover:bg-[var(--dy-surface-hi)]">
                <td className="px-4 py-3 text-sm text-[var(--dy-text)]">{row.type}</td>
                <td className="px-4 py-3 text-sm text-[var(--dy-sub)]">per {row.unit}</td>
                <td className="dy-mono px-4 py-3 text-right text-sm font-medium text-[var(--dy-text)] tabular-nums">
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
    <div className="rounded-xl border border-[var(--dy-red-brd)] bg-[var(--dy-red-dim)] p-6 text-sm text-[var(--dy-text)]">
      <p className="font-semibold mb-1">Unable to load pricing.</p>
      <p className="dy-body mb-3">
        We were unable to fetch live unit costs from our costs service. Please try again
        in a few minutes, or contact support if this persists.
      </p>
      <pre className="overflow-x-auto rounded bg-[var(--dy-surface)] p-3 text-xs text-[var(--dy-red)]">
        {message}
      </pre>
    </div>
  );
}
