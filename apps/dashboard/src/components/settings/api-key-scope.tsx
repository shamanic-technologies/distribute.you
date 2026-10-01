/**
 * What a key is, said where a key is created (API Keys page, Integrations >
 * AI). Since 2026-10-01 (api-service #1073) a key belongs to the USER, across
 * every organization they are a member of, and never carries staff powers.
 * Each call acts in one organization, named by a brand (`brandId`) or an
 * organization (`orgId`), so the line tells the holder to name a brand rather
 * than naming whichever org happens to be open in the dashboard.
 */
export const API_KEY_SCOPE_LINE =
  "This key acts as you, across all your organizations. Name a brand on each call.";

export function ApiKeyScope() {
  return <span>{API_KEY_SCOPE_LINE}</span>;
}
