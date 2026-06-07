import { redirect } from "next/navigation";

// Only one public benchmark feature is live (sales cold email — see
// PUBLIC_BENCHMARK_SLUGS in lib/benchmarks/fetch-benchmark). A one-card index
// adds nothing, so /benchmarks opens the feature page directly.
export default function BenchmarksIndex() {
  redirect("/benchmarks/sales-cold-email-outreach");
}
