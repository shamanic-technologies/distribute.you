"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKFLOW_DEFINITIONS } from "@mcpfactory/content";

const NAV_ITEMS = [
  {
    title: "Getting Started",
    items: [
      { name: "Introduction", href: "/" },
      { name: "Quick Start", href: "/quickstart" },
      { name: "Authentication", href: "/authentication" },
      { name: "MCP Usage", href: "/mcp" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { name: "Overview", href: "/api" },
      { name: "Campaigns", href: "/api/campaigns" },
      { name: "Results", href: "/api/results" },
      { name: "Webhooks", href: "/api/webhooks" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { name: "Overview", href: "/integrations" },
      { name: "ChatGPT", href: "/integrations/chatgpt" },
      { name: "Claude", href: "/integrations/claude" },
      { name: "Cursor", href: "/integrations/cursor" },
      { name: "Cursor Skill", href: "/integrations/cursor-skill" },
      { name: "n8n", href: "/integrations/n8n" },
      { name: "Zapier", href: "/integrations/zapier" },
      { name: "Make.com", href: "/integrations/make" },
    ],
  },
  {
    title: "Workflows",
    items: WORKFLOW_DEFINITIONS.map((wf) => ({
      name: wf.label,
      href: `/${wf.sectionKey}`,
      available: true,
    })),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-gray-100 bg-gradient-to-b from-white to-gray-50/30 p-4 flex-shrink-0 overflow-y-auto">
      <nav className="space-y-6">
        {NAV_ITEMS.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const isAvailable = "available" in item ? item.available : true;
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                        isActive
                          ? "bg-brand-100 text-brand-700 font-medium border border-brand-200"
                          : "text-gray-700 hover:bg-gray-50 hover:text-brand-600"
                      }`}
                    >
                      {"available" in item && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isAvailable ? "bg-brand-500" : "bg-gray-300"
                          }`}
                        />
                      )}
                      {item.name}
                      {!isAvailable && (
                        <span className="text-xs text-gray-400 ml-auto">Soon</span>
                      )}
                    </Link>
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
