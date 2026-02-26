import { callExternalService, externalServices } from "./lib/service-client.js";

const APP_ID = "mcpfactory";

const APP_KEYS: { provider: string; envVar: string }[] = [
  { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
  { provider: "apollo", envVar: "APOLLO_API_KEY" },
  { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
  { provider: "firecrawl", envVar: "FIRECRAWL_API_KEY" },
  { provider: "gemini", envVar: "GEMINI_API_KEY" },
  { provider: "postmark", envVar: "POSTMARK_API_KEY" },
  { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
  { provider: "stripe-webhook", envVar: "STRIPE_WEBHOOK_SECRET" },
];

export async function registerAppKeys(): Promise<void> {
  console.log("[api-service] Registering app keys with key-service...");

  // Warn about missing env vars but don't crash — allows partial deploys
  const missing = APP_KEYS.filter(({ envVar }) => !process.env[envVar]);
  if (missing.length > 0) {
    const names = missing.map(({ envVar }) => envVar).join(", ");
    console.warn(`[api-service] Skipping ${missing.length} app keys with missing env vars: ${names}`);
  }

  // Register all keys that have env vars set — throw on registration failure
  const present = APP_KEYS.filter(({ envVar }) => process.env[envVar]);
  for (const { provider, envVar } of present) {
    const apiKey = process.env[envVar]!;
    await callExternalService(externalServices.key, "/internal/app-keys", {
      method: "POST",
      body: { appId: APP_ID, provider, apiKey },
    });
    console.log(`[api-service] App key registered: ${provider}`);
  }

  console.log(`[api-service] ${present.length}/${APP_KEYS.length} app keys registered successfully`);
}
