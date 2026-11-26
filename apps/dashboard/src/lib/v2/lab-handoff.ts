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

/** Distry's email: a stranger writing here is answered by Distry in the thread and signs up there (crm-service v0.130). */
export const DISTRY_EMAIL = "distry@distribute.you";

/** Opens a mail to Distry, the website already in the subject. */
export function distryMailtoHref(website: string): string {
  const site = website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return site ? `mailto:${DISTRY_EMAIL}?subject=${encodeURIComponent(`Set up distribute.you for ${site}`)}` : `mailto:${DISTRY_EMAIL}`;
}

/** Our Telegram bot: a chat with no account talks with Distry as a guest and signs up there (chat-service v0.63.232). */
export const DISTRY_TELEGRAM_BOT = "https://t.me/distribute_you_bot";

/** Telegram's `start` payload cap. */
const TELEGRAM_START_MAX = 64;

/**
 * Opens our Telegram bot for a visitor with no account, their website riding the start payload
 * (`site-<base64url>`) so Distry opens on it; too long for Telegram's 64 characters = the bare link.
 */
export function distryTelegramStartHref(website: string): string {
  const site = website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!site) return DISTRY_TELEGRAM_BOT;
  const bytes = new TextEncoder().encode(site);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const payload = `site-${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  return payload.length > TELEGRAM_START_MAX ? DISTRY_TELEGRAM_BOT : `${DISTRY_TELEGRAM_BOT}?start=${payload}`;
}

/**
 * The one line a founder pastes in their AI: it adds our MCP server, signs in through the
 * one MCP sign-up (no key, no code to type) and opens on their campaign.
 */
export function labAiPrompt(website: string, mcpUrl: string): string {
  const site = website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `Add distribute.you to your tools: it is an MCP server at ${mcpUrl}. Then sign me in and start my campaign for ${site}, which waits for me.`;
}
