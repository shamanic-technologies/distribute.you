"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { URLS } from "@distribute/content";
import { OPENAPI_DOCUMENT_URL } from "@/lib/docs-routes";
import { CLI_NPM_URL, DEVELOPER_HUB_URL, MCP_URL } from "@/lib/developer-surfaces";

const NAV_ITEMS = [
  {
    title: "Getting Started",
    items: [
      { name: "Introduction", href: "/" },
      { name: "Quick Start", href: "/quickstart" },
      { name: "Authentication", href: "/authentication" },
    ],
  },
  {
    title: "MCP Server",
    items: [
      { name: "Overview", href: "/mcp" },
      { name: "Installation", href: "/mcp/installation" },
      { name: "Tools Reference", href: "/mcp/tools" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { name: "Overview", href: "/api" },
      { name: "OpenAPI Spec", href: "/openapi" },
      { name: "Brands", href: "/api/brands" },
      { name: "Features", href: "/api/features" },
      { name: "Campaigns", href: "/api/campaigns" },
      { name: "Workflows", href: "/api/workflows" },
      { name: "Leads", href: "/api/leads" },
      { name: "Emails", href: "/api/emails" },
      { name: "Billing", href: "/api/billing" },
      { name: "Costs", href: "/api/costs" },
      { name: "Webhooks", href: "/api/webhooks" },
      { name: "Interactive Docs \u2197", href: URLS.apiDocs, external: true },
    ],
  },
  {
    // The apex hub names every developer surface on one page, and a name search
    // lands on whichever of the two domains ranks. A crawlable link from every
    // page of this site is how the two are reachable from each other.
    title: "Developer resources",
    items: [
      { name: "All surfaces \u2197", href: DEVELOPER_HUB_URL, external: true },
      { name: "OpenAPI document \u2197", href: OPENAPI_DOCUMENT_URL, external: true },
      { name: "MCP endpoint \u2197", href: MCP_URL, external: true },
      { name: "Command line client \u2197", href: CLI_NPM_URL, external: true },
    ],
  },
  {
    title: "Integrations",
    items: [
      { name: "Overview", href: "/integrations" },
      { name: "Claude Code", href: "/integrations/claude" },
      { name: "Claude Desktop", href: "/integrations/claude-desktop" },
      { name: "Cursor", href: "/integrations/cursor" },
      { name: "ChatGPT", href: "/integrations/chatgpt" },
      { name: "n8n", href: "/integrations/n8n" },
      { name: "Zapier", href: "/integrations/zapier" },
      { name: "Make.com", href: "/integrations/make" },
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
    <aside className="w-56 h-full border-r border-gray-100 bg-gradient-to-b from-white to-gray-50/30 p-4 flex-shrink-0 overflow-y-auto">
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
