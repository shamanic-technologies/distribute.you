import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Brand Assets",
  description: "Download MCP Factory logos, mascot, and brand assets for press, partnerships, and integrations.",
  openGraph: {
    title: "Brand Assets | MCP Factory",
    description: "Download MCP Factory logos and brand assets.",
  },
};

const ASSETS = [
  {
    name: "Logo (No Title)",
    filename: "mcpfactory_logo_notitle_38kb.jpg",
    description: "Fox mascot without text. Best for favicons and small spaces.",
    size: "38 KB",
    dimensions: "512x512",
  },
  {
    name: "Logo (With Title)",
    filename: "mcpfactory_logo_title_55kb.jpg",
    description: "Fox mascot with MCP Factory text. Best for headers.",
    size: "55 KB",
    dimensions: "800x400",
  },
  {
    name: "Hero Image",
    filename: "mcpfactory_large_hero_120kb.jpg",
    description: "Large hero illustration with mascot in factory setting.",
    size: "120 KB",
    dimensions: "1200x1200",
  },
  {
    name: "LinkedIn Banner",
    filename: "mcpfactory_landscape_linkedin_380kb.jpg",
    description: "Landscape format for LinkedIn posts and covers.",
    size: "380 KB",
    dimensions: "1200x627",
  },
  {
    name: "Twitter/X Banner",
    filename: "mcpfactory_landscape_xtwitter_340kb.jpg",
    description: "Landscape format for Twitter/X posts.",
    size: "340 KB",
    dimensions: "1200x675",
  },
  {
    name: "Google Ads (Horizontal)",
    filename: "mcpfactory_horizontal_googleads_380kb.jpg",
    description: "Horizontal format for Google Ads campaigns.",
    size: "380 KB",
    dimensions: "1200x628",
  },
  {
    name: "Google Ads (Vertical)",
    filename: "mcpfactory_vertical_googleads_380kb.jpg",
    description: "Vertical format for Google Ads campaigns.",
    size: "380 KB",
    dimensions: "628x1200",
  },
];

export default function BrandPage() {
  return (
    <main className="min-h-screen">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-secondary-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-head.jpg" alt="MCP Factory" width={36} height={36} className="rounded-lg" />
            <span className="font-display font-bold text-xl text-primary-600">MCP Factory</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-primary-600 text-sm transition">
              Home
            </Link>
            <a
              href="https://docs.distribute.you"
              className="text-gray-600 hover:text-primary-600 text-sm transition"
            >
              Docs
            </a>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="gradient-bg py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Brand Assets</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Download our logos and brand assets for press, partnerships, and integrations.
            All assets are free to use with attribution.
          </p>
        </div>
      </section>

      {/* Brand Guidelines */}
      <section className="py-12 px-4 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl font-bold mb-6 text-gray-800">Brand Guidelines</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl p-6 border border-primary-200">
              <div className="w-12 h-12 bg-primary-500 rounded-xl mb-3" />
              <p className="font-bold text-gray-800">Primary Orange</p>
              <p className="text-sm text-gray-600 font-mono">#f97316</p>
            </div>
            <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-2xl p-6 border border-secondary-200">
              <div className="w-12 h-12 bg-secondary-400 rounded-xl mb-3" />
              <p className="font-bold text-gray-800">Secondary Pink</p>
              <p className="text-sm text-gray-600 font-mono">#e879f9</p>
            </div>
            <div className="bg-gradient-to-br from-accent-50 to-accent-100 rounded-2xl p-6 border border-accent-200">
              <div className="w-12 h-12 bg-accent-500 rounded-xl mb-3" />
              <p className="font-bold text-gray-800">Accent Teal</p>
              <p className="text-sm text-gray-600 font-mono">#14b8a6</p>
            </div>
          </div>
        </div>
      </section>

      {/* Assets Grid */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-2xl font-bold mb-8 text-gray-800">Download Assets</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ASSETS.map((asset) => (
              <div
                key={asset.filename}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition"
              >
                <div className="aspect-video bg-gradient-to-br from-secondary-50 to-primary-50 flex items-center justify-center p-4">
                  <Image
                    src={`/brand/${asset.filename}`}
                    alt={asset.name}
                    width={300}
                    height={200}
                    className="max-h-full w-auto object-contain rounded-lg shadow-md"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-display font-bold text-gray-800 mb-1">{asset.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{asset.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <span>{asset.dimensions}</span>
                      <span className="mx-2">•</span>
                      <span>{asset.size}</span>
                    </div>
                    <a
                      href={`/brand/${asset.filename}`}
                      download
                      className="text-sm bg-primary-500 text-white px-4 py-1.5 rounded-full hover:bg-primary-600 transition font-medium shadow-sm"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Usage */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-2xl font-bold mb-6 text-gray-800">Usage Guidelines</h2>
          <div className="prose prose-lg">
            <ul>
              <li>Use the assets as-is without modifications to the logo or mascot</li>
              <li>Maintain clear space around the logo (at least 20% of logo width)</li>
              <li>Do not stretch, rotate, or distort the assets</li>
              <li>Credit &quot;MCP Factory&quot; when using assets in press or publications</li>
              <li>For custom integrations or modifications, contact us first</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm">
            Questions? Contact us at{" "}
            <a href="mailto:hello@distribute.you" className="text-primary-400 hover:text-primary-300">
              hello@distribute.you
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
