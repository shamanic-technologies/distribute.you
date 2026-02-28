import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Make.com Integration",
  description: "Create visual automation scenarios with distribute and Make.com. HTTP modules, webhooks, and example scenarios.",
  openGraph: {
    title: "Make.com Integration | distribute Docs",
    description: "Automate distribute campaigns with Make.com.",
  },
};

export default function MakeIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold mb-4">Make.com Integration</h1>
      <p className="text-xl text-gray-600 mb-8">
        Create visual automation scenarios with distribute and Make.com.
      </p>

      <div className="prose prose-lg">
        <h2>Overview</h2>
        <p>
          Make.com (formerly Integromat) is a visual automation platform.
          Connect distribute to build complex scenarios with branching logic
          and data transformations.
        </p>

        <h2>Authentication Setup</h2>
        <ol>
          <li>In your scenario, add an <strong>HTTP</strong> module</li>
          <li>Click <strong>Add</strong> to create a new connection</li>
          <li>
            Select <strong>API Key</strong> authentication
          </li>
          <li>
            Set Header name: <code>Authorization</code>
          </li>
          <li>
            Set Header value: <code>Bearer mcpf_live_xxxx</code>
          </li>
        </ol>

        <h2>HTTP Module Configuration</h2>

        <h3>Create a Campaign</h3>
        <p>
          Add an <strong>HTTP → Make a request</strong> module:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`URL: https://api.mcpfactory.org/campaigns
Method: POST
Headers:
  Content-Type: application/json
Body type: Raw
Content type: JSON (application/json)
Request content:
{
  "mcp": "sales-outreach",
  "target_url": "{{1.website}}",
  "target_audience": "{{1.audience}}",
  "budget": {
    "max_daily_usd": {{1.daily_budget}}
  },
  "schedule": {
    "frequency": "daily",
    "trial_days": {{1.trial_days}}
  },
  "reporting": {
    "webhook_url": "https://hook.make.com/xxxx"
  }
}`}</code>
        </pre>

        <h2>Webhook Triggers</h2>
        <p>
          Use <strong>Webhooks → Custom webhook</strong> to receive campaign
          events:
        </p>
        <ol>
          <li>Add a <strong>Custom webhook</strong> module</li>
          <li>Create a new webhook and copy the URL</li>
          <li>
            Add the URL to your campaign&apos;s <code>reporting.webhook_url</code>
          </li>
        </ol>

        <h3>Webhook Data Structure</h3>
        <p>Configure the webhook data structure for better mapping:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "reply.received",
  "campaign_id": "camp_abc123",
  "data": {
    "email": "john@prospect.com",
    "name": "John Smith",
    "company": "Prospect Inc",
    "reply_sentiment": "positive",
    "reply_preview": "Thanks for reaching out..."
  }
}`}</code>
        </pre>

        <h2>Example Scenarios</h2>

        <h3>1. Google Sheet → Launch Campaigns</h3>
        <p>
          Launch campaigns for each row in a spreadsheet:
        </p>
        <ol>
          <li>
            <strong>Google Sheets:</strong> Watch rows
          </li>
          <li>
            <strong>HTTP:</strong> POST to /campaigns with row data
          </li>
          <li>
            <strong>Google Sheets:</strong> Update row with campaign_id
          </li>
        </ol>

        <h3>2. Reply Received → CRM + Slack</h3>
        <ol>
          <li>
            <strong>Webhooks:</strong> Custom webhook (reply.received)
          </li>
          <li>
            <strong>Router:</strong> Branch by reply_sentiment
          </li>
          <li>
            <strong>Positive branch:</strong>
            <ul>
              <li>HubSpot: Create contact</li>
              <li>Slack: Send message to #sales</li>
            </ul>
          </li>
          <li>
            <strong>Neutral branch:</strong>
            <ul>
              <li>HubSpot: Add to nurture list</li>
            </ul>
          </li>
        </ol>

        <h3>3. Meeting Booked → Full Workflow</h3>
        <ol>
          <li>
            <strong>Webhooks:</strong> Custom webhook (meeting.booked)
          </li>
          <li>
            <strong>Google Calendar:</strong> Create event
          </li>
          <li>
            <strong>HubSpot:</strong> Create deal
          </li>
          <li>
            <strong>Slack:</strong> Notify sales team
          </li>
          <li>
            <strong>Email:</strong> Send confirmation to prospect
          </li>
        </ol>

        <h3>4. Daily Stats Dashboard</h3>
        <ol>
          <li>
            <strong>Schedule:</strong> Every day at 8 AM
          </li>
          <li>
            <strong>HTTP:</strong> GET /campaigns (list all active)
          </li>
          <li>
            <strong>Iterator:</strong> For each campaign
          </li>
          <li>
            <strong>HTTP:</strong> GET /campaigns/:id/stats
          </li>
          <li>
            <strong>Array aggregator:</strong> Combine results
          </li>
          <li>
            <strong>Google Sheets:</strong> Append to dashboard
          </li>
          <li>
            <strong>Slack:</strong> Post daily summary
          </li>
        </ol>

        <h2>API Endpoints Reference</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Method</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Create campaign</td>
              <td>POST</td>
              <td>/campaigns</td>
            </tr>
            <tr>
              <td>List campaigns</td>
              <td>GET</td>
              <td>/campaigns</td>
            </tr>
            <tr>
              <td>Get campaign</td>
              <td>GET</td>
              <td>/campaigns/:id</td>
            </tr>
            <tr>
              <td>Get stats</td>
              <td>GET</td>
              <td>/campaigns/:id/stats</td>
            </tr>
            <tr>
              <td>Pause</td>
              <td>POST</td>
              <td>/campaigns/:id/pause</td>
            </tr>
            <tr>
              <td>Resume</td>
              <td>POST</td>
              <td>/campaigns/:id/resume</td>
            </tr>
          </tbody>
        </table>

        <h2>Tips for Make.com</h2>
        <ul>
          <li>
            Use <strong>Set variable</strong> to store campaign_id for later use
          </li>
          <li>
            Add <strong>Error handlers</strong> for API failures
          </li>
          <li>
            Use <strong>Router</strong> for conditional branching on events
          </li>
          <li>
            <strong>Sleep</strong> module can delay execution if needed
          </li>
          <li>
            Store API key in Make.com&apos;s <strong>Data stores</strong> for
            security
          </li>
        </ul>

        <h2>Rate Limits</h2>
        <p>
          distribute allows 100 requests/minute on Free, 1,000/minute on Pro.
          Use Make.com&apos;s built-in rate limiting to stay within bounds.
        </p>
      </div>
    </div>
  );
}
