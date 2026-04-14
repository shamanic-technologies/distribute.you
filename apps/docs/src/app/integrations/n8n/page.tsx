import { Metadata } from "next";

export const metadata: Metadata = {
  title: "n8n Integration",
  description: "Build automated workflows with distribute and n8n using the REST API.",
};

export default function N8nIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">n8n</h1>
      <p className="text-xl text-gray-500 mb-10">
        Build automated workflows with distribute and n8n.
      </p>

      <div className="prose prose-lg">
        <h2>Setup</h2>
        <p>Use the <strong>HTTP Request</strong> node in n8n to call the distribute REST API:</p>
        <ol>
          <li>Add an HTTP Request node</li>
          <li>Set the base URL to <code>https://api.distribute.you/v1</code></li>
          <li>Add a header: <code>X-API-Key: dist_YOUR_KEY</code></li>
        </ol>

        <h2>Example: Create Campaign on Schedule</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`Method: POST
URL: https://api.distribute.you/v1/campaigns
Headers:
  X-API-Key: dist_YOUR_KEY
  Content-Type: application/json
Body:
{
  "name": "Weekly Outreach",
  "workflowSlug": "sales-email-cold-outreach-apex-v4",
  "brandUrls": ["https://acme.com"],
  "maxBudgetDailyUsd": "10"
}`}</code>
        </pre>

        <h2>Webhook Trigger</h2>
        <p>
          Use the distribute webhook to trigger n8n workflows when events occur
          (replies received, campaigns completed, etc.). See{" "}
          <a href="/api/webhooks">Webhooks</a>.
        </p>

        <h2>API Reference</h2>
        <p>
          See the full <a href="/api">API Reference</a> for all available endpoints.
        </p>
      </div>
    </div>
  );
}
