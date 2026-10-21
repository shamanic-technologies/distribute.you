import { getBrandSalesRep, setBrandSalesRep } from "@/lib/api";
import { accountSalesRep, salesRepDefaultWrite, type SalesRepAccount } from "@/lib/sales-rep-account";

/**
 * A new brand's sales rep defaults to the account that launched it: its email,
 * the phone it gave at signup, and its first name (owner 2026-10-21).
 *
 * Without a rep, a positive reply is forwarded to nobody, and the person who just
 * signed up is the one who wants it. So the terminal launch of every setup flow
 * (`/get-started`, the new-org walk) states them as the rep: copied on every
 * interested reply, rung on it when they gave a number, introduced by first name.
 *
 * Only an EMPTY rep, or one that already IS this account, is filled, and only in
 * its blanks. A brand that names somebody else keeps them.
 *
 * The user is RELOADED first: the phone is saved server-side into Clerk
 * `publicMetadata` and the name by `user.update` minutes earlier in the same walk,
 * so the hook's copy can predate both.
 *
 * Never fatal: the customer has already paid and the campaign is created, so a
 * failure here is logged loudly and the rep stays editable in Brand Settings.
 */
export async function defaultSalesRepToAccount(
  brandId: string,
  user: (SalesRepAccount & { reload?: () => Promise<SalesRepAccount> }) | null | undefined,
): Promise<void> {
  try {
    const fresh = user?.reload ? await user.reload() : user;
    const account = accountSalesRep(fresh);
    if (!account.salesRepEmail) {
      console.error("[dashboard] default sales rep skipped: the account has no email", { brandId });
      return;
    }
    const current = await getBrandSalesRep(brandId);
    const next = salesRepDefaultWrite(current, account);
    if (next) await setBrandSalesRep(brandId, next);
  } catch (err) {
    console.error("[dashboard] default sales rep failed", { brandId }, err);
  }
}
