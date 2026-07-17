import { BrandSetupGate } from "@/components/brand/brand-setup-gate";

// Stays an empty server passthrough (no cookies/headers/uncached fetch) so the
// sibling `loading.tsx` can show its fallback while a sub-route renders (Next
// `loading.js` caveat). `BrandSetupGate` is a CLIENT child — it self-fetches and
// redirects a never-finished brand back to onboarding; it does not gate the paint.
export default function BrandDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BrandSetupGate />
      {children}
    </>
  );
}
