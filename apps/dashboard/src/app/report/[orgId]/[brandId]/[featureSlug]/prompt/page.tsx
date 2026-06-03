import { Suspense } from "react";
import { SectionCard, EmptyState } from "@/components/report/section-card";
import { fetchPromptAssignment } from "@/lib/report-api";
import type { PromptAssignment } from "@/lib/api";

export const revalidate = 14400;
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export default async function PromptPage({ params }: PageProps) {
  const { orgId, featureSlug } = await params;
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <Suspense fallback={<PromptSkeleton />}>
        <PromptSection orgId={orgId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function PromptSection({
  orgId,
  featureSlug,
}: {
  orgId: string;
  featureSlug: string;
}) {
  const assignment = await fetchPromptAssignment(orgId, featureSlug);

  return (
    <SectionCard
      title="Generation prompt"
      description="The prompt used to draft each quote pitch from a journalist's request."
    >
      {!assignment ? (
        <EmptyState message="No generation prompt is configured for this feature yet." />
      ) : (
        <PromptBody assignment={assignment} />
      )}
    </SectionCard>
  );
}

function PromptBody({ assignment }: { assignment: PromptAssignment }) {
  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500">Template</span>
        <code className="text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1 text-gray-700">
          {assignment.promptType}
        </code>
        {assignment.isDefault && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            default
          </span>
        )}
      </div>

      {assignment.variables.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">
            Variables filled in at generation time
          </p>
          <div className="flex flex-wrap gap-1.5">
            {assignment.variables.map((v) => (
              <code
                key={v.name}
                title={v.description}
                className="text-xs bg-brand-50 border border-brand-100 text-brand-700 rounded px-1.5 py-0.5"
              >{`{{${v.name}}}`}</code>
            ))}
          </div>
        </div>
      )}

      <pre className="w-full text-sm border border-gray-200 rounded-lg p-3 font-mono text-gray-700 bg-gray-50 whitespace-pre-wrap break-words">
        {assignment.prompt}
      </pre>
    </div>
  );
}

function PromptSkeleton() {
  return (
    <SectionCard
      title="Generation prompt"
      description="The prompt used to draft each quote pitch from a journalist's request."
    >
      <div className="px-5 py-4 space-y-4">
        <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />
      </div>
    </SectionCard>
  );
}
