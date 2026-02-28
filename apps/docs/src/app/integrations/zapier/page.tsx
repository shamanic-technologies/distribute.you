import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zapier Integration",
  description: "Connect distribute to 5,000+ apps with Zapier. Triggers, actions, and example Zaps for campaign automation.",
  openGraph: {
    title: "Zapier Integration | distribute Docs",
    description: "Automate distribute campaigns with Zapier.",
  },
};

export default function ZapierIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold mb-4">Zapier Integration</h1>
      <p className="text-xl text-gray-600 mb-8">
        Connect distribute to 5,000+ apps with Zapier.
      </p>

      <div className="prose prose-lg">
        <h2>Overview</h2>
        <p>
          Use Zapier to trigger distribute campaigns from any app and send
          results to your favorite tools (Slack, HubSpot, Google Sheets, etc.).
        </p>

        <h2>Setup with Webhooks by Zapier</h2>
        <p>
          Use the <strong>Webhooks by Zapier</strong> app for custom HTTP
          requests to distribute.
        </p>

        <h3>Step 1: Authentication</h3>
        <p>In your Zap, add a header for authentication:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`Header Key: Authorization
Header Value: Bearer mcpf_live_xxxx`}</code>
        </pre>

        <h3>Step 2: Create a Campaign (Action)</h3>
        <p>Use <strong>Webhooks by Zapier → Custom Request</strong>:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`Method: POST
URL: https://api.distribute.you/campaigns
Headers:
  Authorization: Bearer mcpf_live_xxxx
  Content-Type: application/json
Data:
{
  "mcp": "sales-outreach",
  "target_url": "acme.com",
  "target_audience": "CTOs at tech startups",
  "budget": {
    "max_daily_usd": 10
  }
}`}</code>
        </pre>

        <h2>Receive Webhooks (Trigger)</h2>
        <p>
          Use <strong>Webhooks by Zapier → Catch Hook</strong> to receive
          campaign events:
        </p>
        <ol>
          <li>Create a new Zap with <strong>Catch Hook</strong> trigger</li>
          <li>Copy the webhook URL</li>
          <li>
            Add it to your campaign&apos;s <code>reporting.webhook_url</code>
          </li>
        </ol>

        <h2>Example Zaps</h2>

        <h3>1. New Lead in CRM → Launch Campaign</h3>
        <ol>
          <li>
            <strong>Trigger:</strong> New contact in HubSpot/Salesforce
          </li>
          <li>
            <strong>Action:</strong> Webhooks → POST to /campaigns
          </li>
        </ol>

        <h3>2. Campaign Reply → Add to CRM</h3>
        <ol>
          <li>
            <strong>Trigger:</strong> Catch Hook (reply.received event)
          </li>
          <li>
            <strong>Filter:</strong> Only if reply_sentiment = &quot;positive&quot;
          </li>
          <li>
            <strong>Action:</strong> Create contact in HubSpot
          </li>
          <li>
            <strong>Action:</strong> Create task for sales rep
          </li>
        </ol>

        <h3>3. Meeting Booked → Notify Team</h3>
        <ol>
          <li>
            <strong>Trigger:</strong> Catch Hook (meeting.booked event)
          </li>
          <li>
            <strong>Action:</strong> Send Slack message to #sales
          </li>
          <li>
            <strong>Action:</strong> Add to Google Calendar
          </li>
        </ol>

        <h3>4. Daily Stats → Google Sheets</h3>
        <ol>
          <li>
            <strong>Trigger:</strong> Schedule (every day at 9 AM)
          </li>
          <li>
            <strong>Action:</strong> GET /campaigns/:id/stats
          </li>
          <li>
            <strong>Action:</strong> Append row to Google Sheets
          </li>
        </ol>

        <h2>Available Actions</h2>
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>/campaigns</td>
              <td>POST</td>
              <td>Create new campaign</td>
            </tr>
            <tr>
              <td>/campaigns/:id</td>
              <td>GET</td>
              <td>Get campaign details</td>
            </tr>
            <tr>
              <td>/campaigns/:id/stats</td>
              <td>GET</td>
              <td>Get campaign statistics</td>
            </tr>
            <tr>
              <td>/campaigns/:id/pause</td>
              <td>POST</td>
              <td>Pause a campaign</td>
            </tr>
            <tr>
              <td>/campaigns/:id/resume</td>
              <td>POST</td>
              <td>Resume a campaign</td>
            </tr>
          </tbody>
        </table>

        <h2>Webhook Events</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Use Case</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>campaign.started</code></td>
              <td>Notify team when campaign begins</td>
            </tr>
            <tr>
              <td><code>reply.received</code></td>
              <td>Add respondent to CRM</td>
            </tr>
            <tr>
              <td><code>meeting.booked</code></td>
              <td>Create calendar event</td>
            </tr>
            <tr>
              <td><code>campaign.completed</code></td>
              <td>Generate final report</td>
            </tr>
          </tbody>
        </table>

        <h2>Tips</h2>
        <ul>
          <li>
            Use <strong>Formatter by Zapier</strong> to parse JSON responses
          </li>
          <li>
            Add <strong>Filter</strong> steps to only act on relevant events
          </li>
          <li>
            Use <strong>Delay</strong> to wait for campaign results before next
            steps
          </li>
          <li>
            Store your API key in Zapier&apos;s credential storage, not in plain
            text
          </li>
        </ul>
      </div>
    </div>
  );
}
