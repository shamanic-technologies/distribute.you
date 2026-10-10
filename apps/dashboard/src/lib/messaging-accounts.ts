/**
 * Pure helpers for the messaging rows of Integrations (alias-free: unit-tested).
 *
 * crm-service serves one TILE per channel (`links`: what the channel offers) and every
 * ACCOUNT linked or being linked (`accounts`), since a brand can link several numbers
 * on one app (owner 2026-10-10).
 */

interface HasChannel {
  channel: string;
}

/** The accounts of one channel, in the order crm-service serves them. */
export function accountsOfChannel<T extends HasChannel>(data: { accounts: T[] }, channel: string): T[] {
  return data.accounts.filter((a) => a.channel === channel);
}

/**
 * The ways to start a link the row offers, primary first. Cookies (copying browser
 * headers by hand) is not a customer flow: LinkedIn's email and password is.
 */
export function startMethods(methods: string[]): string[] {
  const order = ["qr", "password", "phone"];
  return order.filter((m) => methods.includes(m));
}
