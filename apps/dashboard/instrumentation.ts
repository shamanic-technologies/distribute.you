/**
 * Next.js instrumentation — runs once on server cold start.
 * Registers:
 *  1. Chat config via API service (idempotent)
 *  2. App keys (e.g. Stripe) via key-service (idempotent)
 */
export async function register() {
  // Only run on the server (not during build or edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  await Promise.allSettled([registerChatConfig(), registerAppKeys()]);
}

async function registerChatConfig() {
  const apiUrl =
    process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
  const apiKey = process.env.DISTRIBUTE_API_KEY;

  if (!apiKey) {
    console.warn(
      "[distribute] DISTRIBUTE_API_KEY not set — skipping chat config registration"
    );
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/v1/chat/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        systemPrompt: FOXY_SYSTEM_PROMPT,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[distribute] Chat config registration failed: ${res.status} — ${body}`
      );
      return;
    }

    console.log("[distribute] Chat app config registered via API service");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[distribute] Chat config registration error: ${message}`
    );
  }
}

const APP_ID = "distribute-frontend";

async function registerAppKeys() {
  const keyServiceUrl = process.env.KEY_SERVICE_URL;
  const keyServiceApiKey = process.env.KEY_SERVICE_API_KEY;

  if (!keyServiceUrl || !keyServiceApiKey) {
    console.warn(
      "[distribute] KEY_SERVICE_URL or KEY_SERVICE_API_KEY not set — skipping app key registration"
    );
    return;
  }

  const keys: { provider: string; envVar: string }[] = [
    { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
  ];

  for (const { provider, envVar } of keys) {
    const apiKey = process.env[envVar];
    if (!apiKey) {
      console.warn(
        `[distribute] ${envVar} not set — skipping ${provider} app key registration`
      );
      continue;
    }

    try {
      const res = await fetch(`${keyServiceUrl}/internal/app-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyServiceApiKey,
        },
        body: JSON.stringify({ appId: APP_ID, provider, apiKey }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(
          `[distribute] ${provider} app key registration failed: ${res.status} — ${body}`
        );
        continue;
      }

      console.log(`[distribute] ${provider} app key registered via key-service`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[distribute] ${provider} app key registration error: ${message}`
      );
    }
  }
}

const FOXY_SYSTEM_PROMPT = `You are the distribute assistant. You help users set up and manage their automated distribution campaigns.

You can help with:
- Creating and managing sales cold email campaigns
- Setting up API keys and connecting your own API provider keys
- Configuring distribute for use with AI coding tools (Cursor, Claude Code, etc.)
- Understanding campaign performance and costs
- Explaining how workflows work

Be concise, friendly, and action-oriented. When users want to do something, guide them step by step. If you need more information, ask specific questions rather than open-ended ones.`;
