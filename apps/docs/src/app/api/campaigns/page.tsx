import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata = docsMetadata("/api/campaigns");

// A campaign is what the customer launched (owner 2026-10-10): one brand, one offer, run or paused
// as one, with a max budget and a max volume. Its parts (`units`, one per channel step) are never
// documented as campaigns of their own (owner 2026-10-11). Every route below is in the deployed
// api.distribute.you openapi.json.
const LLM_INSTRUCTIONS = `# Campaigns API

A campaign runs as one: one status, one budget. Inside, it runs one part per channel step (\`units\`). A part is not a campaign: report a campaign by its name (\`salesFunnelName\`).

## List campaigns
GET /v1/sales-funnel-campaigns?brandId=<brandId>
GET /v1/sales-funnel-campaigns?brandId=<brandId>&offerId=<offerId>&status=ongoing

## Get one campaign
GET /v1/sales-funnel-campaigns/:id

## Run or pause a campaign
PATCH /v1/sales-funnel-campaigns/:id
Body: {"status": "activate"} or {"status": "stop"}

## Read or set a campaign's budget
GET /v1/brands/:brandId/offers/:offerId/sales-funnels/:salesFunnelId/caps
PUT /v1/brands/:brandId/offers/:offerId/sales-funnels/:salesFunnelId/caps
Body: {"maxBudget": {"amountCents": 5000, "period": "daily"}, "maxVolume": null}
period: daily, weekly, monthly or one_off. Send both keys; null clears one. No budget means the campaign spends nothing.

## Results of one part
GET /v1/campaigns/:partId/stats   (partId = units[].campaignId)`;

export default function CampaignsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/api/campaigns")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        List your campaigns, run or pause them, set their budget and read their results.
      </p>

      <div className="prose">
        <p>
          A campaign runs as one. It has one status and one budget. Inside, it runs one part per
          channel step, listed in <code>units</code>. A part is not a campaign of its own: name a
          campaign by its <code>salesFunnelName</code>.
        </p>

        <h2>List campaigns</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/sales-funnel-campaigns?brandId=<brandId>
GET /v1/sales-funnel-campaigns?brandId=<brandId>&offerId=<offerId>&status=ongoing
Authorization: Bearer distrib.usr_YOUR_KEY`}</code>
        </pre>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "salesFunnelCampaigns": [
    {
      "id": "7fcf42ab-fe7a-46a5-9375-90fbdd260f18",
      "brandId": "933d4abb-9695-4fcb-b3aa-354d61565798",
      "offerId": "e59646e4-e351-462d-a8a7-618098e7e5c1",
      "salesFunnelId": "lead_found_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked",
      "salesFunnelName": "Bliss",
      "status": "ongoing",
      "stopReason": null,
      "createdAt": "2026-10-10T13:48:01.383Z",
      "updatedAt": "2026-10-10T13:48:01.383Z",
      "units": [
        { "campaignId": "1e95a4c3-…", "featureSlug": "sales-cold-email-outreach", "legKey": "lead_found_to_conversation", "status": "ongoing" }
      ]
    }
  ]
}`}</code>
        </pre>
        <p>
          <code>status</code> is <code>ongoing</code> (running) or <code>stopped</code>. Leave it out
          to get every campaign.
        </p>

        <h2>Get one campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/sales-funnel-campaigns/:id
Authorization: Bearer distrib.usr_YOUR_KEY`}</code>
        </pre>

        <h2>Run or pause a campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`PATCH /v1/sales-funnel-campaigns/:id
Content-Type: application/json
Authorization: Bearer distrib.usr_YOUR_KEY

{ "status": "stop" }`}</code>
        </pre>
        <p>
          <code>stop</code> pauses the whole campaign. <code>activate</code> runs it again. People
          already contacted still get their follow-ups.
        </p>

        <h2>Read or set a campaign&apos;s budget</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/brands/:brandId/offers/:offerId/sales-funnels/:salesFunnelId/caps
PUT /v1/brands/:brandId/offers/:offerId/sales-funnels/:salesFunnelId/caps
Content-Type: application/json
Authorization: Bearer distrib.usr_YOUR_KEY

{
  "maxBudget": { "amountCents": 5000, "period": "daily" },
  "maxVolume": { "count": 200, "period": "monthly" }
}`}</code>
        </pre>
        <p>
          Take <code>salesFunnelId</code> from the campaign. A period is <code>daily</code>,{" "}
          <code>weekly</code>, <code>monthly</code> or <code>one_off</code>. Send both keys;{" "}
          <code>null</code> clears one. A campaign with no budget spends nothing. The read also says
          what the current period used (<code>consumedCents</code>, <code>consumed</code>).
        </p>

        <h2>Results of one part</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:partId/stats
Authorization: Bearer distrib.usr_YOUR_KEY`}</code>
        </pre>
        <p>
          <code>partId</code> is a <code>units[].campaignId</code> of the campaign. The response leads
          with meetings booked, positive replies and delivery rate, then volume and cost.
        </p>
      </div>
    </div>
  );
}
