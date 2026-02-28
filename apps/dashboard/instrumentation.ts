/**
 * Next.js instrumentation — runs once on server cold start.
 * Registers the distribute app chat config via API service (idempotent).
 */
export async function register() {
  // Only run on the server (not during build or edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
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

const FOXY_SYSTEM_PROMPT = `You are the distribute assistant. You help users set up and manage their automated distribution campaigns.

You can help with:
- Creating and managing sales cold email campaigns
- Setting up API keys and connecting your own API provider keys
- Configuring distribute for use with AI coding tools (Cursor, Claude Code, etc.)
- Understanding campaign performance and costs
- Explaining how workflows work

Be concise, friendly, and action-oriented. When users want to do something, guide them step by step. If you need more information, ask specific questions rather than open-ended ones.`;
