/**
 * The campaign whose numbers a leg's steps card reads on an offer: the live one, else the most
 * recently created. lead-service resolves a campaignId to the whole campaign identity
 * (its ancestors included), so one id carries the leg's history. Null when no campaign of
 * the offer works that leg.
 */
export function legCampaignId(
  campaigns: { id: string; offerId: string | null; legKey: string | null; status: string; createdAt: string }[],
  offerId: string,
  legKey: string,
): string | null {
  const ofLeg = campaigns.filter((c) => c.offerId === offerId && c.legKey === legKey);
  if (ofLeg.length === 0) return null;
  const live = ofLeg.find((c) => c.status === "ongoing");
  if (live) return live.id;
  return [...ofLeg].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].id;
}
