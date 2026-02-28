import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Set up your distribute API keys and configure your own API credentials for Apollo, Anthropic, and more.",
  openGraph: {
    title: "Authentication | distribute Docs",
    description: "Configure API keys and credentials.",
  },
};

const LLM_INSTRUCTIONS = `# distribute Authentication

## 1. Create Account
Sign up at: https://dashboard.distribute.you/sign-up

## 2. Get API Key
Dashboard → API Keys
Format: mcpf_xxxxxxxxxxxxxxxxxxxx

## 3. Using the API Key

### For MCP (ChatGPT, Claude, Cursor):
Authorization: Bearer mcpf_YOUR_KEY

### For REST API:
X-API-Key: mcpf_YOUR_KEY

## 4. Your Own API Keys (Optional)
Dashboard → API Keys

Supported providers:
- Apollo: For lead search (get key at apollo.io)
- Anthropic: For AI email generation (get key at console.anthropic.com)

Keys are encrypted with AES-256-GCM.`;

export default function AuthenticationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Authentication</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Set up your API keys and configure your own provider credentials to start using distribute.
      </p>

      <div className="prose prose-lg">
        <h2>1. Create an Account</h2>
        <p>
          Sign up at{" "}
          <a href="https://dashboard.distribute.you/sign-up">
            dashboard.distribute.you
          </a>{" "}
          to get started. You can use email or Google OAuth.
        </p>

        <h2>2. Get Your API Key</h2>
        <p>
          After signing in, go to{" "}
          <strong>API Keys</strong> to generate your distribute API
          key.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>mcpf_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
        </pre>
        <p>
          <strong>Keep this key secret.</strong> It grants full access to your
          account and organization.
        </p>

        <h2>3. Using Your API Key</h2>

        <h3>For MCP (ChatGPT, Claude, Cursor)</h3>
        <p>Include as Bearer token in the Authorization header:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>Authorization: Bearer YOUR_API_KEY</code>
        </pre>

        <h3>For REST API</h3>
        <p>Include in the X-API-Key header:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: YOUR_API_KEY"`}</code>
        </pre>

        <h2>4. Configure Your API Keys (Optional)</h2>
        <p>
          distribute can use your own API keys for underlying services. Go to{" "}
          <strong>API Keys</strong> to configure them.
        </p>

        <h3>Supported Providers</h3>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Where to Get</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Apollo</td>
              <td>Lead search and enrichment</td>
              <td>
                <a href="https://app.apollo.io/#/settings/integrations/api">
                  apollo.io
                </a>
              </td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>AI content generation</td>
              <td>
                <a href="https://console.anthropic.com/">
                  console.anthropic.com
                </a>
              </td>
            </tr>
          </tbody>
        </table>

        <h3>Benefits of Using Your Own Keys</h3>
        <ul>
          <li>Use your own API credits and pricing</li>
          <li>Higher rate limits</li>
          <li>Full control over your data</li>
        </ul>

        <h2>5. Verify Setup</h2>
        <p>Test your configuration:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: YOUR_API_KEY"`}</code>
        </pre>
        <p>You should see your account details and organization info.</p>

        <h2>Security Best Practices</h2>
        <ul>
          <li>Never commit API keys to version control</li>
          <li>Use environment variables for local development</li>
          <li>Rotate keys periodically</li>
          <li>Use organization-level keys for team access</li>
        </ul>
      </div>
    </div>
  );
}
