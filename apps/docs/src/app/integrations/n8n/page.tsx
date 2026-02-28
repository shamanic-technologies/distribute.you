import { Metadata } from "next";

export const metadata: Metadata = {
  title: "n8n Integration",
  description: "Build automated workflows with distribute and n8n. HTTP requests, webhooks, and example workflows.",
  openGraph: {
    title: "n8n Integration | distribute Docs",
    description: "Automate distribute campaigns with n8n workflows.",
  },
};

export default function N8nIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold mb-4">n8n Integration</h1>
      <p className="text-xl text-gray-600 mb-8">
        Build automated workflows with distribute using n8n.
      </p>

      <div className="prose prose-lg">
        <h2>Overview</h2>
        <p>
          n8n is a powerful workflow automation tool. Integrate distribute to
          trigger campaigns from any event and receive results via webhooks.
        </p>

        <h2>Authentication Setup</h2>
        <p>Create an HTTP Header Auth credential in n8n:</p>
        <ol>
          <li>Go to <strong>Credentials → Add Credential</strong></li>
          <li>Select <strong>Header Auth</strong></li>
          <li>Set Name: <code>Authorization</code></li>
          <li>Set Value: <code>Bearer mcpf_live_xxxx</code></li>
        </ol>

        <h2>Create a Campaign</h2>
        <p>Use the HTTP Request node to launch a campaign:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`Method: POST
URL: https://api.distribute.you/campaigns
Headers:
  Content-Type: application/json
Body:
{
  "mcp": "sales-outreach",
  "target_url": "{{ $json.website }}",
  "target_audience": "{{ $json.audience }}",
  "budget": {
    "max_daily_usd": 10
  },
  "schedule": {
    "frequency": "daily",
    "trial_days": 5
  },
  "reporting": {
    "webhook_url": "https://your-n8n-instance.com/webhook/xxx"
  }
}`}</code>
        </pre>

        <h2>Receive Webhook Events</h2>
        <p>
          Create a Webhook trigger node to receive campaign updates:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`// Incoming webhook payload
{
  "event": "campaign.milestone",
  "campaign_id": "camp_abc123",
  "data": {
    "milestone": "100_emails_sent",
    "stats": {
      "emails_sent": 100,
      "delivered": 94,
      "opened": 21,
      "replied": 3
    }
  }
}`}</code>
        </pre>

        <h3>Available Webhook Events</h3>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>campaign.started</code></td>
              <td>Campaign has started</td>
            </tr>
            <tr>
              <td><code>campaign.milestone</code></td>
              <td>Reached a milestone (100, 500, 1000 emails)</td>
            </tr>
            <tr>
              <td><code>campaign.paused</code></td>
              <td>Campaign was paused</td>
            </tr>
            <tr>
              <td><code>campaign.completed</code></td>
              <td>Campaign finished</td>
            </tr>
            <tr>
              <td><code>campaign.budget_warning</code></td>
              <td>80% of budget used</td>
            </tr>
            <tr>
              <td><code>campaign.budget_exceeded</code></td>
              <td>Budget limit reached</td>
            </tr>
            <tr>
              <td><code>reply.received</code></td>
              <td>Someone replied to an email</td>
            </tr>
            <tr>
              <td><code>meeting.booked</code></td>
              <td>A meeting was booked</td>
            </tr>
          </tbody>
        </table>

        <h2>Example Workflow: CRM Integration</h2>
        <p>
          Automatically add leads who reply to your CRM:
        </p>
        <ol>
          <li>
            <strong>Webhook Trigger</strong> - Receive <code>reply.received</code> events
          </li>
          <li>
            <strong>IF Node</strong> - Check if reply is positive
          </li>
          <li>
            <strong>HTTP Request</strong> - Create lead in HubSpot/Salesforce
          </li>
          <li>
            <strong>Slack</strong> - Notify sales team
          </li>
        </ol>

        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`// Example: reply.received webhook payload
{
  "event": "reply.received",
  "campaign_id": "camp_abc123",
  "data": {
    "email": "john@prospect.com",
    "name": "John Smith",
    "company": "Prospect Inc",
    "reply_sentiment": "positive",
    "reply_preview": "Thanks for reaching out! I'd love to schedule a call..."
  }
}`}</code>
        </pre>

        <h2>Example Workflow: Daily Report to Slack</h2>
        <ol>
          <li>
            <strong>Schedule Trigger</strong> - Every day at 9 AM
          </li>
          <li>
            <strong>HTTP Request</strong> - GET /campaigns/:id/stats
          </li>
          <li>
            <strong>Slack</strong> - Post summary to #sales channel
          </li>
        </ol>

        <h2>Get Campaign Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`Method: GET
URL: https://api.distribute.you/campaigns/{{ $json.campaign_id }}/stats

Response:
{
  "campaign_id": "camp_abc123",
  "status": "running",
  "stats": {
    "emails_sent": 247,
    "delivered": 231,
    "opened": 54,
    "replied": 12,
    "meetings_booked": 3
  },
  "costs": {
    "total_byok_usd": 4.23
  }
}`}</code>
        </pre>

        <h2>Pause/Resume Campaigns</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`// Pause
POST https://api.distribute.you/campaigns/{{ $json.campaign_id }}/pause

// Resume
POST https://api.distribute.you/campaigns/{{ $json.campaign_id }}/resume`}</code>
        </pre>
      </div>
    </div>
  );
}
