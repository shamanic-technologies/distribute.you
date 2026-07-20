"use client";

import { useUser, useOrganization } from "@clerk/nextjs";

// distribute support = WhatsApp Pro. Users message us directly; we reply from
// our phone. Prefilled with the signed-in user's email + org so the incoming
// chat arrives identified (no anonymous "who is this").
const SUPPORT_PHONE = "33680478702";

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 32 32" fill="#ffffff" aria-hidden="true" className="h-6 w-6 sm:h-[30px] sm:w-[30px]">
      <path d="M16.001 3.2C8.93 3.2 3.2 8.93 3.2 16c0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.56-1.72A12.7 12.7 0 0 0 16 28.8c7.07 0 12.8-5.73 12.8-12.8S23.07 3.2 16 3.2Zm0 23.04c-1.98 0-3.92-.53-5.6-1.54l-.4-.24-3.9 1.02 1.04-3.8-.26-.4A10.2 10.2 0 0 1 5.76 16c0-5.65 4.6-10.24 10.24-10.24S26.24 10.35 26.24 16 21.65 26.24 16 26.24Zm5.62-7.66c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.7.16-.2.3-.8 1-.98 1.2-.18.2-.36.23-.67.08-.31-.16-1.3-.48-2.48-1.53-.92-.82-1.54-1.83-1.72-2.14-.18-.3-.02-.47.14-.62.14-.14.31-.36.46-.54.16-.18.2-.3.31-.51.1-.2.05-.38-.03-.54-.08-.15-.7-1.68-.96-2.3-.25-.6-.5-.52-.7-.53l-.6-.01c-.2 0-.54.08-.82.38-.28.3-1.08 1.05-1.08 2.57 0 1.51 1.1 2.97 1.26 3.18.15.2 2.17 3.3 5.25 4.63.73.32 1.3.5 1.75.65.74.23 1.4.2 1.93.12.59-.09 1.82-.74 2.08-1.46.26-.72.26-1.34.18-1.46-.08-.13-.28-.2-.6-.36Z" />
    </svg>
  );
}

/**
 * Floating WhatsApp support button (bottom-right FAB).
 *
 * `raised` lifts it above a bottom-pinned CTA bar on MOBILE only (onboarding
 * StepShell pins a full-width CTA; a bottom-right FAB would overlap its right
 * edge on small screens). On sm+ the layout has no bottom bar so it drops back
 * to the standard corner offset.
 */
export function SupportButton({ raised = false }: { raised?: boolean }) {
  const { user } = useUser();
  const { organization } = useOrganization();

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";
  const org = organization?.name ?? "";

  const intro = email
    ? `Hi! I'm ${email}${org ? ` (${org})` : ""} and I have a question:`
    : "Hi! I have a question about distribute:";
  const href = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(intro)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={`fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#2563eb] shadow-lg transition hover:scale-105 hover:shadow-xl sm:h-14 sm:w-14 ${
        raised ? "bottom-24 sm:bottom-4" : "bottom-4"
      }`}
    >
      <WhatsAppGlyph />
    </a>
  );
}
