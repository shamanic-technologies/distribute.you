import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";
import {
  API_KEYS_URL,
  API_KEY_PLACEHOLDER,
  API_KEY_PREFIX,
  AUTH_HEADER_LINE,
  AUTH_HEADER_NAME,
  CLAUDE_CODE_MCP_COMMAND,
  CLI_INSTALL_COMMAND,
  CLI_NPM_URL,
  CLI_PACKAGE,
  DEVELOPER_HUB_URL,
  MCP_URL,
  curlExample,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/authentication");

const LLM_INSTRUCTIONS = `# distribute.you Authentication

One key, one header, everywhere. The REST API and the MCP server take the same
credential, and it carries your org and user identity, so nothing else is sent.

## 1. Create an account
Sign up at: dashboard.distribute.you/sign-up

## 2. Get an API key
Dashboard, API Keys, Create key.
Format: ${API_KEY_PREFIX}xxxxxxxxxxxxxxxxxxxx

## 3. Send it

### REST API
${AUTH_HEADER_LINE}

${curlExample("/v1/me")}

### MCP server (hosted, Streamable HTTP)
Endpoint: ${MCP_URL}
Header:   ${AUTH_HEADER_LINE}
Claude Code: ${CLAUDE_CODE_MCP_COMMAND}

### Command line
${CLI_INSTALL_COMMAND}
The CLI stores the key once and sends the same header.

## Security
- A key is scoped to one organization
- Rotate keys periodically from the dashboard
- Never commit a key to version control`;

export default function AuthenticationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/authentication")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        One key and one header, for the REST API, the MCP server and the CLI alike.
      </p>

      <div className="prose">
        <h2>1. Create an account</h2>
        <p>
          Sign up at <a href={URLS.signUp}>dashboard.distribute.you</a> to get started.
        </p>

        <h2>2. Get your API key</h2>
        <p>
          After signing in, go to <strong>API Keys</strong> and create a new key. A key looks like
          this:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`${API_KEY_PREFIX}xxxxxxxxxxxxxxxxxxxxxxxx`}</code>
        </pre>
        <p>
          <strong>Keep this key secret.</strong> It grants full access to your organization. Issue
          and revoke keys at <a href={API_KEYS_URL}>{API_KEYS_URL}</a>.
        </p>

        <h2>3. Send it</h2>
        <p>
          The key is a <strong>Bearer token</strong> in the <code>{AUTH_HEADER_NAME}</code> header.
          It already carries your org and your user, so no other identity header is needed.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{AUTH_HEADER_LINE}</code>
        </pre>

        <h3>REST API</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{curlExample("/v1/me")}</code>
        </pre>

        <h3>MCP server</h3>
        <p>
          The MCP server is hosted at <code>{MCP_URL}</code> and takes the same header. From Claude
          Code:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLAUDE_CODE_MCP_COMMAND}</code>
        </pre>

        <h3>Command line</h3>
        <p>
          The CLI authenticates once with the same key and then reads and changes brands, campaigns,
          leads, audiences, workflows, runs and billing. It is on npm as{" "}
          <a href={CLI_NPM_URL}>{CLI_PACKAGE}</a>.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLI_INSTALL_COMMAND}</code>
        </pre>

        <h2>4. Verify</h2>
        <p>Test the key with one call:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{curlExample("/v1/me")}</code>
        </pre>
        <p>
          You should see your user id and organization id. A <code>401</code> means the header is
          missing, the scheme is not <code>Bearer</code>, or the key is not one of yours: a key
          always starts with <code>{API_KEY_PREFIX}</code>, and a placeholder such as{" "}
          <code>{API_KEY_PLACEHOLDER}</code> is not a key.
        </p>

        <h2>Security</h2>
        <ul>
          <li>A key is scoped to one organization</li>
          <li>Never commit a key to version control</li>
          <li>Use environment variables for local development</li>
          <li>Rotate keys periodically from the dashboard</li>
          <li>You can create several keys and revoke them individually</li>
        </ul>

        <p>
          Every developer surface is named together at{" "}
          <a href={DEVELOPER_HUB_URL}>{DEVELOPER_HUB_URL}</a>.
        </p>
      </div>
    </div>
  );
}
