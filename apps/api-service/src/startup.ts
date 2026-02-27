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

  // Crash on missing env vars — all keys are required
  const missing = APP_KEYS.filter(({ envVar }) => !process.env[envVar]);
  if (missing.length > 0) {
    const names = missing.map(({ envVar }) => envVar).join(", ");
    throw new Error(`Missing required env vars: ${names}`);
  }

  for (const { provider, envVar } of APP_KEYS) {
    const apiKey = process.env[envVar]!;
    await callExternalService(externalServices.key, "/internal/app-keys", {
      method: "POST",
      body: { appId: APP_ID, provider, apiKey },
    });
    console.log(`[api-service] App key registered: ${provider}`);
  }

  console.log(`[api-service] ${APP_KEYS.length}/${APP_KEYS.length} app keys registered successfully`);
}
