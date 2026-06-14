// Static outbound signature appended to every generated outreach email at send-time
// (email-gateway). The stored email body the dashboard fetches does NOT include it,
// so we render it right after the body in every surface where a sent / example email
// is shown — the preview then matches exactly what the recipient receives, making it
// clear the email genuinely goes out from the real account.
//
// Pure presentational + API-free → safe to import from public-report components
// (components/report/*) which must not pull in the Clerk-authed API client.

const SIGNATURE_TEXT = "--\n\nKevin Lourd | Founder\nDistribute.you | Marketing Agency";

export function EmailSignature({ className = "" }: { className?: string }) {
  return (
    <div
      aria-label="Email signature"
      className={`mt-3 whitespace-pre-wrap font-sans text-gray-400 ${className}`}
    >
      {SIGNATURE_TEXT}
    </div>
  );
}
