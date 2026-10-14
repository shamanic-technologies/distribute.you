import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";

export const metadata = docsMetadata("/integrations/n8n");

export default function N8nIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">{docsHeading("/integrations/n8n")}</h1>
      <p className="text-base text-gray-500 mb-8">
        Build automated workflows with distribute.you and n8n.
      </p>

      <div className="prose">
        <h2>Setup</h2>
        <p>Use the <strong>HTTP Request</strong> node in n8n to call the distribute.you REST API:</p>
        <ol>
          <li>Add an HTTP Request node</li>
          <li>Set the base URL to <code>https://api.distribute.you/v1</code></li>
          <li>Add a header: <code>Authorization: Bearer distrib.usr_YOUR_KEY</code></li>
        </ol>

        <h2>Example: change a campaign&apos;s caps on a schedule</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`Method: PUT
URL: https://api.distribute.you/v1/brands/:brandId/offers/:offerId/sales-funnels/:salesFunnelId/caps
Headers:
  Authorization: Bearer distrib.usr_YOUR_KEY
  Content-Type: application/json
Body:
{
  "maxBudget": { "amountCents": 5000, "period": "weekly" },
  "maxVolume": null
}`}</code>
        </pre>
        <p>
          A campaign is one sales funnel run for one offer. Take <code>brandId</code>,{" "}
          <code>offerId</code> and <code>salesFunnelId</code> from{" "}
          <code>GET /v1/sales-funnel-campaigns?brandId=...</code>. See the{" "}
          <a href="/api/campaigns">Campaigns API</a>.
        </p>

        <h2>API Reference</h2>
        <p>
          See the full <a href="/api">API Reference</a> for all available endpoints.
        </p>
      </div>
    </div>
  );
}
