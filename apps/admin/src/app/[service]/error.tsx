"use client";

export default function ServiceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-red-700 mb-4">Failed to load service</h1>
      <pre className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800 whitespace-pre-wrap mb-4">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}
