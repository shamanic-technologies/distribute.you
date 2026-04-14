import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Make.com Integration",
  description: "Create visual automation scenarios with distribute and Make.com using the REST API.",
};

export default function MakeIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">Make.com</h1>
      <p className="text-base text-gray-500 mb-8">
        Create visual automation scenarios with distribute.
      </p>

      <div className="prose">
        <h2>Setup</h2>
        <p>Use the <strong>HTTP</strong> module in Make.com to call the distribute REST API:</p>
        <ol>
          <li>Add an HTTP module to your scenario</li>
          <li>Select <strong>Make a request</strong></li>
          <li>Set the URL to <code>https://api.distribute.you/v1/...</code></li>
          <li>Add a header: <code>X-API-Key: dist_YOUR_KEY</code></li>
        </ol>

        <h2>Webhook Trigger</h2>
        <p>
          Use a <strong>Custom Webhook</strong> trigger to receive distribute events.
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
