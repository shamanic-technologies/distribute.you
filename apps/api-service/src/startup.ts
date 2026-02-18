import { callExternalService, externalServices } from "./lib/service-client.js";

const APP_ID = "mcpfactory";

const APP_KEYS: { provider: string; envVar: string }[] = [
  { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
  { provider: "apollo", envVar: "APOLLO_API_KEY" },
  { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
];

export async function registerAppKeys(): Promise<void> {
  console.log("[api-service] Registering app keys with key-service...");

  const results = await Promise.allSettled(
    APP_KEYS.map(async ({ provider, envVar }) => {
      const apiKey = process.env[envVar];
      if (!apiKey) {
        console.warn(`[api-service] App key ${provider} skipped: ${envVar} not set`);
        return;
      }

      await callExternalService(externalServices.key, "/internal/app-keys", {
        method: "POST",
        body: { appId: APP_ID, provider, apiKey },
      });
      console.log(`[api-service] App key registered: ${provider}`);
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    for (const f of failed) {
      console.error("[api-service] App key registration failed:", (f as PromiseRejectedResult).reason?.message);
    }
  }

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  console.log(`[api-service] App key registration complete: ${succeeded}/${APP_KEYS.length} processed`);
}
