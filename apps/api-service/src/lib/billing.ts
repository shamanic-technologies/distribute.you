import { callExternalService, externalServices } from "./service-client.js";

interface BillingModeResponse {
  billingMode: "byok" | "pay-as-you-go";
}

/**
 * Resolve the keySource for an org by calling billing-service.
 * Falls back to "app" (platform keys) if billing-service is unreachable.
 */
export async function fetchKeySource(orgId: string): Promise<"app" | "byok"> {
  try {
    const result = await callExternalService<BillingModeResponse>(
      externalServices.billing,
      `/orgs/${encodeURIComponent(orgId)}/billing-mode`
    );
    return result.billingMode === "byok" ? "byok" : "app";
  } catch (err) {
    console.warn("[billing] Failed to fetch billing mode, defaulting to 'app':", (err as Error).message);
    return "app";
  }
}
