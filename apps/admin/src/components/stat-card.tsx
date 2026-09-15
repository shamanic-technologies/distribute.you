/**
 * The one figure tile every /metrics tab draws above its charts.
 *
 * Deliberately carries NO "use client" directive: it is rendered by the server
 * page (the Unique-visitors view) and by the two client views beside it, and a
 * module stating no directive compiles for both. Declaring it client-only would
 * drag the server page into the client bundle to gain nothing — it holds no
 * state, no effect and no handler.
 */
export interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  accent: string;
}

export function StatCard({ label, value, detail, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}
