import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ApiKeyPreview } from "@/components/api-key-preview";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";

export default async function DashboardHome() {
  const user = await currentUser();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-gray-600">Select a feature to get started.</p>
      </div>

      {/* API Key Section */}
      <div className="mb-8 max-w-md">
        <ApiKeyPreview />
      </div>

      {/* Organizations Section */}
      <div className="mb-8">
        <h2 className="font-display text-lg font-bold text-gray-800 mb-4">
          Organizations
        </h2>
        <Link
          href="/orgs"
          className="block bg-white rounded-2xl border border-gray-200 p-6 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Organizations</h3>
              <p className="text-sm text-gray-500">Manage your organizations and brands</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Features Section */}
      <div className="mb-8">
        <h2 className="font-display text-lg font-bold text-gray-800 mb-4">
          Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="features-grid">
          {WORKFLOW_DEFINITIONS.map((feature) => (
            <Link
              key={feature.sectionKey}
              href={`/features/${feature.sectionKey}`}
              className={`block bg-white rounded-2xl border border-gray-200 p-6 transition-all ${
                feature.implemented
                  ? "hover:border-brand-300 hover:shadow-md"
                  : "opacity-75"
              }`}
              data-testid="feature-card"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display font-bold text-lg text-gray-800">
                  {feature.label}
                </h3>
                {!feature.implemented && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
