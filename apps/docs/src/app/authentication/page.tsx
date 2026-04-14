import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Set up your distribute API key and authenticate requests via MCP or REST API.",
  openGraph: {
    title: "Authentication | distribute Docs",
    description: "Configure API keys and credentials.",
  },
};

const LLM_INSTRUCTIONS = `# distribute Authentication

## 1. Create Account
Sign up at: dashboard.distribute.you/sign-up

## 2. Get API Key
Dashboard → API Keys → Create Key
Format: dist_xxxxxxxxxxxxxxxxxxxx

## 3. Using the API Key

### For MCP Server:
npx @distribute/mcp --api-key=dist_YOUR_KEY
# or
DISTRIBUTE_API_KEY=dist_YOUR_KEY npx @distribute/mcp

### For REST API:
X-API-Key: dist_YOUR_KEY

### For TypeScript Client:
import { DistributeClient } from "@distribute/api-client";
const client = new DistributeClient({ apiKey: "dist_YOUR_KEY" });

## Security
- Keys are scoped to your organization
- Rotate keys periodically via the dashboard
- Never commit keys to version control`;

export default function AuthenticationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Authentication</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Set up your API key to authenticate with distribute.
      </p>

      <div className="prose">
        <h2>1. Create an Account</h2>
        <p>
          Sign up at{" "}
          <a href={URLS.signUp}>dashboard.distribute.you</a>{" "}
          to get started.
        </p>

        <h2>2. Get Your API Key</h2>
        <p>
          After signing in, go to <strong>API Keys</strong> and create a new key.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>dist_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
        </pre>
        <p>
          <strong>Keep this key secret.</strong> It grants full access to your organization.
        </p>

        <h2>3. Using Your API Key</h2>

        <h3>MCP Server</h3>
        <p>Pass the key via CLI flag or environment variable:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`# CLI flag
npx @distribute/mcp --api-key=dist_YOUR_KEY

# Environment variable
DISTRIBUTE_API_KEY=dist_YOUR_KEY npx @distribute/mcp`}</code>
        </pre>

        <h3>REST API</h3>
        <p>Include your key in the <code>X-API-Key</code> header:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: dist_YOUR_KEY"`}</code>
        </pre>

        <h3>TypeScript Client</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`import { DistributeClient } from "@distribute/api-client";

const client = new DistributeClient({
  apiKey: "dist_YOUR_KEY",
});

const me = await client.getMe();
console.log(me); // { userId, orgId, authType }`}</code>
        </pre>

        <h2>4. Verify Setup</h2>
        <p>Test your key with a simple API call:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: dist_YOUR_KEY"`}</code>
        </pre>
        <p>You should see your user ID and organization ID.</p>

        <h2>Security</h2>
        <ul>
          <li>API keys are scoped to your organization</li>
          <li>Never commit keys to version control</li>
          <li>Use environment variables for local development</li>
          <li>Rotate keys periodically via the dashboard</li>
          <li>You can create multiple keys and revoke them individually</li>
        </ul>
      </div>
    </div>
  );
}
