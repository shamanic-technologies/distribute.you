import { getBrandSalesRep, setBrandSalesRep } from "@/lib/api";

/**
 * A new brand's sales rep defaults to the email of the account that launched it.
 *
 * Without a rep, a positive reply is forwarded to nobody, and the person who just
 * signed up is the one who wants it. So the terminal launch of every setup flow
 * (`/onboarding`, `/get-started`, the new-org modal) states their own email as the
 * rep, with no phone: copied on every interested reply, never rung.
 *
 * Only an EMPTY rep is filled. A brand that already names somebody (a second
 * brand added to an org whose rep was set by hand, a resumed launch) keeps them.
 *
 * Never fatal: the customer has already paid and the campaign is created, so a
 * failure here is logged loudly and the rep stays editable in Brand Settings.
 */
export async function defaultSalesRepToAccountEmail(
  brandId: string,
  accountEmail: string | null | undefined,
): Promise<void> {
  const email = accountEmail?.trim();
  if (!email) {
    console.error("[dashboard] default sales rep skipped: the account has no email", { brandId });
    return;
  }
  try {
    const current = await getBrandSalesRep(brandId);
    if (current.salesRepEmail || current.salesRepPhone) return;
    await setBrandSalesRep(brandId, { salesRepEmail: email, salesRepPhone: null });
  } catch (err) {
    console.error("[dashboard] default sales rep failed", { brandId }, err);
  }
}
