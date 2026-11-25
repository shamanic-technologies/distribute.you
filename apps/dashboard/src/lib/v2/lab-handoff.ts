/**
 * Links of the lab's channel hand-off (`components/v2/get-started/lab-handoff.tsx`).
 * Alias-free: unit-tested directly.
 */

/** Distry's WhatsApp line, the same number the support button opens. */
export const DISTRY_WHATSAPP = "33680478702";

/** Opens a chat with Distry on WhatsApp, the first message typed for the founder. */
export function distryWhatsAppHref(text: string): string {
  return `https://wa.me/${DISTRY_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/**
 * The one line a founder pastes in their AI: it adds our MCP server, signs in through the
 * one MCP sign-up (no key, no code to type) and opens on their campaign.
 */
export function labAiPrompt(website: string, mcpUrl: string): string {
  const site = website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `Add distribute.you to your tools: it is an MCP server at ${mcpUrl}. Then sign me in and show me how my campaign for ${site} is doing.`;
}
