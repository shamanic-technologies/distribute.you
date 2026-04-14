import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zapier Integration",
  description: "Connect distribute to 5,000+ apps with Zapier using the REST API and webhooks.",
};

export default function ZapierIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">Zapier</h1>
      <p className="text-base text-gray-500 mb-8">
        Connect distribute to 5,000+ apps with Zapier.
      </p>

      <div className="prose">
        <h2>Setup</h2>
        <p>Use <strong>Webhooks by Zapier</strong> to call the distribute REST API:</p>
        <ol>
          <li>Create a new Zap</li>
          <li>Choose your trigger (schedule, webhook, another app)</li>
          <li>Add a <strong>Webhooks by Zapier</strong> action</li>
          <li>Select <strong>Custom Request</strong></li>
          <li>Configure with the distribute API endpoint</li>
        </ol>

        <h2>Example: Campaign Stats to Slack</h2>
        <ol>
          <li><strong>Trigger:</strong> Schedule (daily)</li>
          <li><strong>Action 1:</strong> Webhooks by Zapier &rarr; GET <code>https://api.distribute.you/v1/campaigns/stats</code> with header <code>X-API-Key: dist_YOUR_KEY</code></li>
          <li><strong>Action 2:</strong> Slack &rarr; Send Channel Message with stats summary</li>
        </ol>

        <h2>Incoming Webhooks</h2>
        <p>
          Use <strong>Catch Hook</strong> as a trigger to receive distribute webhook events.
          See <a href="/api/webhooks">Webhooks</a>.
        </p>

        <h2>API Reference</h2>
        <p>
          See the full <a href="/api">API Reference</a> for all available endpoints.
        </p>
      </div>
    </div>
  );
}
