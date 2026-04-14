"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { URLS } from "@distribute/content";

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
      { name: "Brands", href: "/api/brands" },
      { name: "Features", href: "/api/features" },
      { name: "Campaigns", href: "/api/campaigns" },
      { name: "Workflows", href: "/api/workflows" },
      { name: "Leads", href: "/api/leads" },
      { name: "Emails", href: "/api/emails" },
      { name: "Outlets", href: "/api/outlets" },
      { name: "Journalists", href: "/api/journalists" },
      { name: "Articles", href: "/api/articles" },
      { name: "Press Kits", href: "/api/press-kits" },
      { name: "Billing", href: "/api/billing" },
      { name: "Costs", href: "/api/costs" },
      { name: "Webhooks", href: "/api/webhooks" },
      { name: "Interactive Docs \u2197", href: URLS.apiDocs, external: true },
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

export function Sidebar() {
  const pathname = usePathname();

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
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
                const isExternal = "external" in item && item.external;
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
                          ? "bg-brand-100 text-brand-700 font-medium border border-brand-200"
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
