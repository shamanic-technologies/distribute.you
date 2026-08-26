import Link from "next/link";

/**
 * Rendered for `notFound()` calls made from inside a page (an unknown blog
 * slug, for example). Unmatched URLs are handled by the catch-all route
 * handler, which can negotiate markdown for an agent; this one is the human
 * fallback for a path that DID match a page and had nothing to show.
 *
 * Plain Tailwind grays, not the `--dy-*` tokens: the React landing pages render
 * on a hardcoded-white body, so a themed token resolves to its dark value and
 * reads as light text on white.
 */
export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const LINKS: { href: string; label: string; hint: string }[] = [
  { href: "/", label: "Home", hint: "What we do and what it costs." },
  { href: "/pricing", label: "Pricing", hint: "The live unit prices behind every campaign." },
  { href: "/performance", label: "Performance", hint: "Our own published numbers." },
  { href: "/about", label: "About", hint: "How the agency and the billing work." },
  { href: "/contact", label: "Contact", hint: "One address, read by the team." },
  { href: "/blog", label: "Blog", hint: "Playbooks and field notes." },
];

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">404</p>
      <h1 className="mt-3 text-4xl font-bold text-gray-900">That page is not here.</h1>
      <p className="mt-4 text-base text-gray-600">
        The address you asked for does not exist on distribute.you. Nothing is broken on your
        side. Here is where the rest of the site lives.
      </p>
      <ul className="mt-8 space-y-3">
        {LINKS.map((link) => (
          <li key={link.href} className="border-b border-gray-200 pb-3">
            <Link href={link.href} className="text-base font-medium text-gray-900 underline">
              {link.label}
            </Link>
            <span className="ml-2 text-sm text-gray-600">{link.hint}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-gray-500">
        Reading this with an agent? <a className="underline" href="/llms.txt">/llms.txt</a> states
        when to use distribute.you and where the developer surfaces are, and every page on this
        domain is also served as markdown when you send an Accept header that asks for it.
      </p>
    </main>
  );
}
