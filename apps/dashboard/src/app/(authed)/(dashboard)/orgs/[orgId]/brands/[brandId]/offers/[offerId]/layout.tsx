// Stays an empty server passthrough (no cookies/headers/uncached fetch) so the
// sibling `loading.tsx` can show its fallback while an offer sub-route renders
// (Next `loading.js` caveat). The brand layout above it already mounts
// `BrandSetupGate`; an offer needs no second gate.
export default function OfferLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
