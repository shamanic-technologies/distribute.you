import { callExternalService, externalServices } from "./lib/service-client.js";

const PLATFORM_KEYS: { provider: string; envVar: string }[] = [
  { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
  { provider: "apollo", envVar: "APOLLO_API_KEY" },
  { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
  { provider: "firecrawl", envVar: "FIRECRAWL_API_KEY" },
  { provider: "gemini", envVar: "GEMINI_API_KEY" },
  { provider: "postmark", envVar: "POSTMARK_API_KEY" },
  { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
  { provider: "stripe-webhook", envVar: "STRIPE_WEBHOOK_SECRET" },
];

export async function registerPlatformKeys(): Promise<void> {
  console.log("[api-service] Registering platform keys with key-service...");

  // Crash on missing env vars — all keys are required
  const missing = PLATFORM_KEYS.filter(({ envVar }) => !process.env[envVar]);
  if (missing.length > 0) {
    const names = missing.map(({ envVar }) => envVar).join(", ");
    throw new Error(`Missing required env vars: ${names}`);
  }

  for (const { provider, envVar } of PLATFORM_KEYS) {
    const apiKey = process.env[envVar]!;
    await callExternalService(externalServices.key, "/internal/platform-keys", {
      method: "POST",
      body: { provider, apiKey },
    });
    console.log(`[api-service] Platform key registered: ${provider}`);
  }

  console.log(`[api-service] ${PLATFORM_KEYS.length}/${PLATFORM_KEYS.length} platform keys registered successfully`);
}
