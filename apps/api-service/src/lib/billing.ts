import { callExternalService, externalServices } from "./service-client.js";

interface BillingAccountResponse {
  id: string;
  orgId: string;
  appId: string;
  billingMode: "trial" | "byok" | "payg";
  creditBalanceCents: number;
  hasPaymentMethod: boolean;
}

/**
 * Resolve the keySource for an org by calling billing-service.
 * Uses GET /v1/accounts which auto-creates the billing account if it doesn't exist,
 * avoiding 404 errors for new orgs.
 * Throws if billing-service is unreachable — never silently defaults.
 */
export async function fetchKeySource(orgId: string): Promise<"app" | "byok"> {
  const result = await callExternalService<BillingAccountResponse>(
    externalServices.billing,
    "/v1/accounts",
    { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
  );
  return result.billingMode === "byok" ? "byok" : "app";
}
