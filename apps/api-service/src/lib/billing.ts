import { callExternalService, externalServices } from "./service-client.js";

interface BalanceResponse {
  balance_cents: number;
  billing_mode: "trial" | "byok" | "payg";
  depleted: boolean;
}

/**
 * Resolve the keySource for an org by calling billing-service.
 * Throws if billing-service is unreachable — never silently defaults.
 */
export async function fetchKeySource(orgId: string): Promise<"app" | "byok"> {
  const result = await callExternalService<BalanceResponse>(
    externalServices.billing,
    "/v1/accounts/balance",
    { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
  );
  return result.billing_mode === "byok" ? "byok" : "app";
}
