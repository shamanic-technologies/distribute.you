import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Results API",
  description: "Retrieve campaign statistics, replies, usage data, and community benchmarks via the distribute API.",
  openGraph: {
    title: "Results API | distribute Docs",
    description: "Campaign results and statistics endpoints.",
  },
};

export default function ResultsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold mb-4">Results API</h1>
      <p className="text-xl text-gray-600 mb-8">
        Retrieve campaign statistics, usage data, and community benchmarks.
      </p>

      <div className="prose prose-lg">
        <h2>Campaign Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /campaigns/:id/stats`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign_id": "camp_abc123",
  "period": {
    "start": "2026-01-30T00:00:00Z",
    "end": "2026-02-04T23:59:59Z"
  },
  "stats": {
    "emails_sent": 487,
    "delivered": 456,
    "bounced": 31,
    "opened": 112,
    "clicked": 34,
    "replied": 23,
    "unsubscribed": 2,
    "meetings_booked": 5
  },
  "rates": {
    "delivery_rate": 0.936,
    "open_rate": 0.246,
    "click_rate": 0.075,
    "reply_rate": 0.050,
    "conversion_rate": 0.011
  },
  "costs": {
    "total_byok_usd": 8.74,
    "breakdown": {
      "ai_generation": 2.15,
      "lead_enrichment": 4.87,
      "email_sending": 1.72
    }
  }
}`}</code>
        </pre>

        <h2>Daily Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /campaigns/:id/stats/daily
GET /campaigns/:id/stats/daily?start=2026-01-30&end=2026-02-04`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign_id": "camp_abc123",
  "daily": [
    {
      "date": "2026-01-30",
      "emails_sent": 97,
      "opened": 21,
      "replied": 4,
      "cost_usd": 1.73
    },
    {
      "date": "2026-01-31",
      "emails_sent": 102,
      "opened": 24,
      "replied": 5,
      "cost_usd": 1.82
    }
  ]
}`}</code>
        </pre>

        <h2>Replies</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /campaigns/:id/replies
GET /campaigns/:id/replies?sentiment=positive`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign_id": "camp_abc123",
  "replies": [
    {
      "id": "reply_xyz789",
      "email": "john@prospect.com",
      "name": "John Smith",
      "company": "Prospect Inc",
      "sentiment": "positive",
      "preview": "Thanks for reaching out! I'd love to schedule...",
      "received_at": "2026-01-31T14:23:00Z"
    }
  ],
  "pagination": {
    "total": 23,
    "page": 1,
    "per_page": 20
  }
}`}</code>
        </pre>

        <h2>Account Usage</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /usage
GET /usage?period=month`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "period": "2026-01",
  "usage": {
    "campaigns_created": 3,
    "emails_sent": 1247,
    "emails_remaining": 8753,
    "byok_cost_usd": 22.45
  },
  "plan": {
    "name": "Free",
    "price_usd": 0
  }
}`}</code>
        </pre>

        <h2>Community Benchmarks</h2>
        <p>See how your campaigns compare to the community average:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /benchmarks
GET /benchmarks?mcp=sales-outreach`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcp": "sales-outreach",
  "sample_size": 1247,
  "benchmarks": {
    "delivery_rate": {
      "average": 0.942,
      "p25": 0.912,
      "p50": 0.945,
      "p75": 0.968
    },
    "open_rate": {
      "average": 0.231,
      "p25": 0.182,
      "p50": 0.225,
      "p75": 0.274
    },
    "reply_rate": {
      "average": 0.048,
      "p25": 0.031,
      "p50": 0.045,
      "p75": 0.062
    },
    "avg_cost_per_email_usd": {
      "average": 0.018,
      "p25": 0.015,
      "p50": 0.017,
      "p75": 0.021
    }
  },
  "updated_at": "2026-01-30T00:00:00Z"
}`}</code>
        </pre>

        <h2>Export Data</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /campaigns/:id/export?format=csv
GET /campaigns/:id/export?format=json`}</code>
        </pre>
        <p>
          Returns a downloadable file with all campaign data including sent
          emails, opens, clicks, and replies.
        </p>
      </div>
    </div>
  );
}
