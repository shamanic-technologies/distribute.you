"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { URLS } from "@distribute/content";
import { OPENAPI_DOCUMENT_URL } from "@/lib/docs/docs-routes";
import { CLI_NPM_URL, MCP_URL } from "@/lib/docs/developer-surfaces";

const NAV_ITEMS = [
  {
    title: "Getting Started",
    items: [
      { name: "Introduction", href: "/docs" },
      { name: "Quick Start", href: "/docs/quickstart" },
      { name: "Authentication", href: "/docs/authentication" },
    ],
  },
  {
    title: "MCP Server",
    items: [
      { name: "Overview", href: "/docs/mcp" },
      { name: "Installation", href: "/docs/mcp/installation" },
      { name: "Tools Reference", href: "/docs/mcp/tools" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { name: "Overview", href: "/docs/api" },
      { name: "OpenAPI Spec", href: "/docs/openapi" },
      { name: "Brands", href: "/docs/api/brands" },
      { name: "Features", href: "/docs/api/features" },
      { name: "Campaigns", href: "/docs/api/campaigns" },
      { name: "Workflows", href: "/docs/api/workflows" },
      { name: "Leads", href: "/docs/api/leads" },
      { name: "Emails", href: "/docs/api/emails" },
      { name: "Billing", href: "/docs/api/billing" },
      { name: "Costs", href: "/docs/api/costs" },
      { name: "Interactive Docs \u2197", href: URLS.apiDocs, external: true },
    ],
  },
  {
    // The machine-readable surfaces at their own addresses, crawlable from every docs page.
    title: "Developer resources",
    items: [
      { name: "OpenAPI document \u2197", href: OPENAPI_DOCUMENT_URL, external: true },
      { name: "MCP endpoint \u2197", href: MCP_URL, external: true },
      { name: "Command line client \u2197", href: CLI_NPM_URL, external: true },
    ],
  },
  {
    title: "Integrations",
    items: [
      { name: "Overview", href: "/docs/integrations" },
      { name: "Claude Code", href: "/docs/integrations/claude" },
      { name: "Claude Desktop", href: "/docs/integrations/claude-desktop" },
      { name: "Cursor", href: "/docs/integrations/cursor" },
      { name: "ChatGPT", href: "/docs/integrations/chatgpt" },
      { name: "n8n", href: "/docs/integrations/n8n" },
      { name: "Zapier", href: "/docs/integrations/zapier" },
      { name: "Make.com", href: "/docs/integrations/make" },
    ],
  },
];

/**
 * The ONE nav item the page belongs to: the longest internal href that equals
 * the path or prefixes it. A per-item prefix test lit "/api" beside
 * "/api/campaigns" (two selected rows on every API page).
 */
export function activeNavHref(pathname: string, hrefs: string[]): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: string | null = null;
  for (const href of hrefs) {
    const hit = path === href || (href !== "/" && path.startsWith(href + "/"));
    if (hit && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

const INTERNAL_HREFS = NAV_ITEMS.flatMap((s) => s.items.filter((i) => !("external" in i)).map((i) => i.href));

export function Sidebar() {
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname, INTERNAL_HREFS);

  return (
    <aside className="w-56 h-full border-r border-gray-100 bg-linear-to-b from-white to-gray-50/30 p-4 shrink-0 overflow-y-auto">
      <nav className="space-y-5">
        {NAV_ITEMS.map((section) => (
          <div key={section.title}>
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2.5">
              {section.title}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isExternal = "external" in item && item.external;
                const isActive = !isExternal && item.href === activeHref;
                const LinkComponent = isExternal ? "a" : Link;
                const linkProps = isExternal
                  ? { href: item.href, target: "_blank" as const, rel: "noopener noreferrer" }
                  : { href: item.href };

                return (
                  <li key={item.href}>
                    <LinkComponent
                      {...linkProps}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition ${
                        isActive
                          ? "bg-brand-50 text-brand-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {item.name}
                    </LinkComponent>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
