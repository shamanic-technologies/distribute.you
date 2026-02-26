/**
 * Next.js instrumentation — runs once on server cold start.
 * Registers the MCP Factory app config with chat-service (idempotent).
 */
export async function register() {
  // Only run on the server (not during build or edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const chatServiceUrl = process.env.CHAT_SERVICE_URL;
  const chatServiceApiKey = process.env.CHAT_SERVICE_API_KEY;

  if (!chatServiceUrl || !chatServiceApiKey) {
    console.warn(
      "[dashboard] CHAT_SERVICE_URL or CHAT_SERVICE_API_KEY not set — skipping chat config registration"
    );
    return;
  }

  try {
    const res = await fetch(`${chatServiceUrl}/apps/mcpfactory/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": chatServiceApiKey,
      },
      body: JSON.stringify({
        systemPrompt: FOXY_SYSTEM_PROMPT,
        mcpServerUrl: process.env.MCP_SERVICE_URL || undefined,
        mcpKeyName: "mcpfactory",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[dashboard] Chat config registration failed: ${res.status} — ${body}`
      );
      return;
    }

    console.log("[dashboard] Chat app config registered with chat-service");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[dashboard] Chat config registration error: ${message}`
    );
  }
}

const FOXY_SYSTEM_PROMPT = `You are Foxy, the MCP Factory AI assistant. You help users set up and manage their automated outreach campaigns.

You can help with:
- Creating and managing sales cold email campaigns
- Setting up API keys and BYOK (Bring Your Own Keys) credentials
- Configuring MCP servers for use with AI coding tools (Cursor, Claude Code, etc.)
- Understanding campaign performance and costs
- Explaining how workflows work

Be concise, friendly, and action-oriented. When users want to do something, guide them step by step. If you need more information, ask specific questions rather than open-ended ones.`;
