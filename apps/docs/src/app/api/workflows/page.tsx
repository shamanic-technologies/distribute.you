import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workflows API",
  description: "List workflows, inspect DAGs, get summaries, and check API key status via the distribute API.",
};

export default function WorkflowsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Workflows</h1>
      <p className="text-xl text-gray-500 mb-10">
        Inspect workflow details, execution graphs, and API key requirements.
      </p>

      <div className="prose prose-lg">
        <h2>List Workflows</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/workflows
GET /v1/workflows?featureDynastySlug=sales-email-cold-outreach
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns all workflows, optionally filtered by feature.</p>

        <h2>Get Workflow</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/workflows/:workflowId
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns full workflow details including the DAG (directed acyclic graph),
          nodes, edges, required providers, and version info.
        </p>

        <h2>Workflow Summary</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/workflows/:workflowId/summary
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns a human-readable summary of what the workflow does, its steps,
          and required API providers.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "workflowSlug": "sales-email-cold-outreach-apex-v4",
  "summary": "Finds leads via Apollo, generates personalized cold emails...",
  "requiredProviders": ["anthropic", "apollo", "resend"],
  "steps": [
    "Scrape brand website",
    "Search leads via Apollo",
    "Generate personalized emails",
    "Send via Resend",
    "Track delivery and replies"
  ]
}`}</code>
        </pre>

        <h2>Key Status</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/workflows/:workflowId/key-status
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Checks whether all required API keys are configured for this workflow.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "workflowSlug": "sales-email-cold-outreach-apex-v4",
  "ready": true,
  "keys": [
    { "provider": "anthropic", "configured": true, "keySource": "platform" },
    { "provider": "apollo", "configured": true, "keySource": "org" }
  ],
  "missing": []
}`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { workflows } = await client.listWorkflows({ featureDynastySlug: "sales-email-cold-outreach" });
const workflow = await client.getWorkflow("wf_abc123");
const summary = await client.getWorkflowSummary("wf_abc123");
const keyStatus = await client.getWorkflowKeyStatus("wf_abc123");`}</code>
        </pre>
      </div>
    </div>
  );
}
