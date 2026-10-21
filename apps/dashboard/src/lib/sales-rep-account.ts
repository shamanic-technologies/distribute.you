import { toE164 } from "./phone-syntax";
import { accountPhone } from "./v2/get-started";

/** brand-service's own rule (`normalizeSalesRepPhone`): `+`, then 8-15 digits, no leading 0. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** The account fields a default rep is built from (a Clerk user carries all three). */
export interface SalesRepAccount {
  primaryEmailAddress?: { emailAddress: string } | null;
  firstName?: string | null;
  publicMetadata?: Record<string, unknown> | null;
}

/** The rep facts the account itself gave us. Each one null when it never gave it. */
export interface AccountSalesRep {
  salesRepEmail: string | null;
  salesRepPhone: string | null;
  salesRepFirstName: string | null;
}

/**
 * What the account that launched a brand told us about itself, as a sales rep:
 * its email, the phone it typed at signup (Clerk `publicMetadata`, the same place
 * the get-started phone stage reads), its first name. Nothing is guessed: a fact
 * the person never gave stays null. The rep has no last-name field; the hand-over
 * introduces the rep by first name ("I've copied Marie").
 */
export function accountSalesRep(account: SalesRepAccount | null | undefined): AccountSalesRep {
  const email = account?.primaryEmailAddress?.emailAddress?.trim() || null;
  const phone = accountPhone(account?.publicMetadata ?? null);
  const e164 = phone ? toE164(phone) : "";
  // brand-service refuses the WHOLE rep on a number outside strict E.164, which
  // would drop the email with it: a number it cannot dial is left out, loudly.
  const dialable = E164.test(e164);
  if (e164 && !dialable) console.error("[dashboard] account phone is not E.164, rep left without it", { e164 });
  const firstName = account?.firstName?.trim() || null;
  return { salesRepEmail: email, salesRepPhone: dialable ? e164 : null, salesRepFirstName: firstName };
}

/** The current rep, as read from brand-service. */
export interface CurrentSalesRep {
  salesRepEmail: string | null;
  salesRepPhone: string | null;
  salesRepFirstName: string | null;
  salesRepRole: string | null;
}

/**
 * The rep to write, or null to leave the brand alone.
 *
 * - No rep yet: the account's own facts.
 * - A rep that IS this account (same email): fill only the blanks (phone, first
 *   name), never overwrite what is there. That is a brand defaulted to the email
 *   before the phone and name were part of the default.
 * - Anybody else: theirs, untouched.
 */
export function salesRepDefaultWrite(
  current: CurrentSalesRep,
  account: AccountSalesRep,
): (CurrentSalesRep & { salesRepEmail: string }) | null {
  if (!account.salesRepEmail) return null;
  const empty = !current.salesRepEmail && !current.salesRepPhone;
  const isAccount =
    current.salesRepEmail?.trim().toLowerCase() === account.salesRepEmail.toLowerCase();
  if (!empty && !isAccount) return null;
  const next = {
    salesRepEmail: current.salesRepEmail || account.salesRepEmail,
    salesRepPhone: current.salesRepPhone || account.salesRepPhone,
    salesRepFirstName: current.salesRepFirstName || account.salesRepFirstName,
    salesRepRole: current.salesRepRole,
  };
  const changed =
    next.salesRepEmail !== current.salesRepEmail ||
    next.salesRepPhone !== current.salesRepPhone ||
    next.salesRepFirstName !== current.salesRepFirstName;
  return changed ? next : null;
}
