import Link from "next/link";
import {
  MCP_ENDPOINT_URL,
  OPENAPI_DOCUMENT_URL,
} from "@/lib/docs-routes";

/**
 * The 404 body.
 *
 * `output: "export"` writes this to `404.html`, which Cloudflare Pages serves
 * with a real HTTP 404 status, so the status code is unchanged by this page.
 * What changes is that the body now says where to go next: the default was the
 * app shell with nothing in it, which tells a reader nothing and tells an agent
 * following a stale link even less.
 */
export default function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">
        Page not found on distribute.you Docs
      </h1>
      <p className="text-base text-gray-500 mb-8">
        This URL does not exist. Everything this site publishes is listed below.
      </p>

      <div className="prose">
        <h2>Start here</h2>
        <ul>
          <li>
            <Link href="/">Documentation home</Link>
          </li>
          <li>
            <Link href="/quickstart/">Quick Start</Link>
          </li>
          <li>
            <Link href="/authentication/">Authentication</Link>
          </li>
        </ul>

        <h2>Reference</h2>
        <ul>
          <li>
            <Link href="/api/">distribute.you API Reference</Link>
          </li>
          <li>
            <Link href="/mcp/">distribute.you MCP Server</Link>
          </li>
          <li>
            <Link href="/mcp/tools/">MCP Tools Reference</Link>
          </li>
          <li>
            <Link href="/integrations/">Integrations</Link>
          </li>
        </ul>

        <h2>Machine-readable</h2>
        <ul>
          <li>
            <a href="/llms.txt">/llms.txt</a>, every page on this site with a
            one-line summary
          </li>
          <li>
            <a href="/sitemap.xml">/sitemap.xml</a>, every URL this site serves
          </li>
          <li>
            <a href={OPENAPI_DOCUMENT_URL}>{OPENAPI_DOCUMENT_URL}</a>, the
            OpenAPI document for the REST API
          </li>
          <li>
            <a href={MCP_ENDPOINT_URL}>{MCP_ENDPOINT_URL}</a>, the hosted MCP
            server over Streamable HTTP
          </li>
        </ul>

        <h2>Elsewhere</h2>
        <ul>
          <li>
            <a href="https://distribute.you">distribute.you</a>, the product
          </li>
          <li>
            <a href="https://dashboard.distribute.you">
              dashboard.distribute.you
            </a>
            , your account and API keys
          </li>
        </ul>
      </div>
    </div>
  );
}
