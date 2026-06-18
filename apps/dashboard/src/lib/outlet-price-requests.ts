import type { OutletListResponse, OutletPriceRequestResult } from "@/lib/api";

export function markOutletPriceRequestsOngoing(
  previous: OutletListResponse | undefined,
  results: OutletPriceRequestResult[],
): OutletListResponse | undefined {
  if (!previous) return previous;
  const ongoingOutletIds = new Set(
    results
      .filter((result) => result.status === "ongoing")
      .map((result) => result.outletId),
  );
  if (ongoingOutletIds.size === 0) return previous;

  return {
    ...previous,
    outlets: previous.outlets.map((outlet) =>
      ongoingOutletIds.has(outlet.id)
        ? { ...outlet, priceRequestStatus: "ongoing" }
        : outlet,
    ),
  };
}
