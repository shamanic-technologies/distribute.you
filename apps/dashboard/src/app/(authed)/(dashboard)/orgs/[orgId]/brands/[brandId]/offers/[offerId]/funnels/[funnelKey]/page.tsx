/**
 * ONE sales funnel's campaigns.
 *
 * The level between an offer and a campaign: an offer sells through funnels, and a
 * campaign buys one LEG of one of them, so a campaign has a cost per step and no
 * return of its own while the funnel has one.
 *
 * The SAME `CampaignsPage` every campaign surface renders, narrowed by the funnel in
 * the route. A second copy is how a campaign comes to read one way here and another
 * way one click over.
 */
export { CampaignsPage as default } from "@/components/campaigns/campaigns-page";
