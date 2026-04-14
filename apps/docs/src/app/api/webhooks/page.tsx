import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Webhooks",
  description: "Receive real-time notifications for campaign events. Webhook events, payload structure, and signature verification.",
  openGraph: {
    title: "Webhooks | distribute Docs",
    description: "Real-time webhook notifications for distribute.",
  },
};

export default function WebhooksApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">Webhooks</h1>
      <p className="text-base text-gray-500 mb-8">
        Receive real-time notifications when campaign events occur.
      </p>

      <div className="prose">
        <h2>Overview</h2>
        <p>
          Webhooks allow you to receive HTTP POST requests when events occur in
          your campaigns. Configure a webhook URL when creating a campaign or
          in your dashboard settings.
        </p>

        <h2>Configuration</h2>

        <h3>Per-Campaign Webhook</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /campaigns
{
  "mcp": "sales-outreach",
  "target_url": "acme.com",
  "reporting": {
    "webhook_url": "https://your-server.com/webhooks/distribute"
  }
}`}</code>
        </pre>

        <h3>Global Webhook (Dashboard)</h3>
        <p>
          Go to <strong>Settings → Webhooks</strong> to configure a webhook that
          receives events from all campaigns.
        </p>

        <h2>Webhook Payload</h2>
        <p>All webhooks are sent as HTTP POST with JSON body:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST https://your-server.com/webhooks/distribute
Content-Type: application/json
X-Distribute-Signature: sha256=xxxxx

{
  "id": "evt_abc123",
  "event": "reply.received",
  "created_at": "2026-01-31T14:23:00Z",
  "campaign_id": "camp_abc123",
  "data": {
    // Event-specific data
  }
}`}</code>
        </pre>

        <h2>Events</h2>

        <h3>campaign.started</h3>
        <p>Campaign has begun processing.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "campaign.started",
  "campaign_id": "camp_abc123",
  "data": {
    "mcp": "sales-outreach",
    "target_url": "acme.com"
  }
}`}</code>
        </pre>

        <h3>campaign.milestone</h3>
        <p>Reached a volume milestone (100, 500, 1000 emails).</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "campaign.milestone",
  "campaign_id": "camp_abc123",
  "data": {
    "milestone": "100_emails",
    "stats": {
      "emails_sent": 100,
      "delivered": 94,
      "opened": 21,
      "replied": 3
    }
  }
}`}</code>
        </pre>

        <h3>campaign.paused</h3>
        <p>Campaign was paused (manually or due to budget).</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "campaign.paused",
  "campaign_id": "camp_abc123",
  "data": {
    "reason": "budget_exceeded",
    "budget_spent_usd": 10.23,
    "budget_limit_usd": 10.00
  }
}`}</code>
        </pre>

        <h3>campaign.completed</h3>
        <p>Campaign finished (trial ended or schedule complete).</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "campaign.completed",
  "campaign_id": "camp_abc123",
  "data": {
    "reason": "trial_ended",
    "final_stats": {
      "emails_sent": 487,
      "delivered": 456,
      "opened": 112,
      "replied": 23,
      "meetings_booked": 5
    },
    "total_cost_usd": 8.74
  }
}`}</code>
        </pre>

        <h3>reply.received</h3>
        <p>Someone replied to a campaign email.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "reply.received",
  "campaign_id": "camp_abc123",
  "data": {
    "reply_id": "reply_xyz789",
    "email": "john@prospect.com",
    "name": "John Smith",
    "company": "Prospect Inc",
    "title": "CTO",
    "sentiment": "positive",
    "preview": "Thanks for reaching out! I'd love to schedule a call to discuss...",
    "received_at": "2026-01-31T14:23:00Z"
  }
}`}</code>
        </pre>

        <h3>meeting.booked</h3>
        <p>A meeting was scheduled via calendar link.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "meeting.booked",
  "campaign_id": "camp_abc123",
  "data": {
    "email": "john@prospect.com",
    "name": "John Smith",
    "company": "Prospect Inc",
    "meeting_time": "2026-02-03T15:00:00Z",
    "calendar_link": "https://calendar.google.com/..."
  }
}`}</code>
        </pre>

        <h3>budget.warning</h3>
        <p>80% of daily/weekly/monthly budget used.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "event": "budget.warning",
  "campaign_id": "camp_abc123",
  "data": {
    "budget_type": "daily",
    "spent_usd": 8.12,
    "limit_usd": 10.00,
    "percentage": 81
  }
}`}</code>
        </pre>

        <h2>Verifying Signatures</h2>
        <p>
          All webhooks include an <code>X-Distribute-Signature</code> header.
          Verify it to ensure the request is from distribute:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</code>
        </pre>
        <p>
          Get your webhook secret from{" "}
          <strong>Dashboard → Settings → Webhooks</strong>.
        </p>

        <h2>Retries</h2>
        <p>
          If your endpoint returns a non-2xx status, we retry with exponential
          backoff:
        </p>
        <ul>
          <li>Retry 1: 1 minute</li>
          <li>Retry 2: 5 minutes</li>
          <li>Retry 3: 30 minutes</li>
          <li>Retry 4: 2 hours</li>
          <li>Retry 5: 24 hours</li>
        </ul>
        <p>After 5 failed retries, the webhook is marked as failed.</p>

        <h2>Testing</h2>
        <p>
          Use <strong>Dashboard → Webhooks → Test</strong> to send a test event
          to your endpoint.
        </p>
      </div>
    </div>
  );
}
