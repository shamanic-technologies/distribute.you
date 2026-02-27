import { callExternalService, externalServices } from "./service-client.js";

export type KeySource = "platform" | "app" | "byok";

interface BillingAccount {
  id: string;
  orgId: string;
  appId: string;
  billingMode: "trial" | "byok" | "payg";
  creditBalanceCents: number;
  hasPaymentMethod: boolean;
}

/**
 * Resolve the keySource for an org by calling billing-service.
 * Uses GET /v1/accounts which auto-creates the billing account if missing.
 * Throws if billing-service is unreachable — never silently defaults.
 */
export async function fetchKeySource(orgId: string): Promise<KeySource> {
  const result = await callExternalService<BillingAccount>(
    externalServices.billing,
    "/v1/accounts",
    { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId, "x-key-source": "platform" } }
  );
  if (result.billingMode === "byok") return "byok";
  return "platform";
}
