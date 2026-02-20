import Link from "next/link";
import { URLS } from "@mcpfactory/content";

export function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display font-bold text-xl text-gray-800">
            MCP Factory <span className="text-primary-500">Performance</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/brands" className="text-gray-600 hover:text-primary-600 transition">
              By Brand
            </Link>
            <Link href="/models" className="text-gray-600 hover:text-primary-600 transition">
              By Workflow
            </Link>
            <Link href="/prompts" className="text-gray-600 hover:text-primary-600 transition">
              By Prompt
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a
            href={URLS.landing}
            className="text-gray-500 hover:text-primary-600 transition"
          >
            mcpfactory.org
          </a>
          <a
            href={URLS.signUp}
            className="px-4 py-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition text-sm font-medium"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
