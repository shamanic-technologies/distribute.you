import { redirect } from "next/navigation";

// Performance is now consolidated into the cold-email benchmark page (the only
// GA product). This route redirects so existing /performance links keep working.
export default function PerformancePage() {
  redirect("/benchmarks/sales-cold-email-outreach");
}
