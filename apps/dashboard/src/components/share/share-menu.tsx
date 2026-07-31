"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LinkIcon, ShareIcon } from "@heroicons/react/24/outline";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  createBrandShareToken,
  getBrandShareToken,
  type BrandShareToken,
} from "@/lib/api";
import { brandFromPathname, brandShareUrl } from "@/lib/brand-share";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "../maturity-badge";

/**
 * "Share" in the top bar, replacing the theme toggle.
 *
 * BETA-GATED: minting a public link exposes a brand's profile to anyone holding
 * the URL, so the control ships to the beta allowlist first. The gate rides the
 * control itself (the surrounding header stays GA), and the badge rides the
 * button, per the repo rule that a gated surface must SAY it is gated.
 *
 * BRAND-SCOPED on purpose: the header renders on every page, so an unconditional
 * Share button would offer to share the billing page and the API-keys page.
 * Off a brand route it renders nothing.
 *
 * The menu holds one item today. It is still a menu rather than a bare button
 * because "share" is a family of actions (a public link now; a teammate invite,
 * an export, a scheduled report later), and a button that silently becomes a
 * menu later is a worse change than a menu with one item now.
 */
export function ShareMenu() {
  const pathname = usePathname();
  const brand = brandFromPathname(pathname);
  const queryClient = useQueryClient();
  const isBeta = useIsBetaUser();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reading is separate from minting, and only the READ runs on open: a brand is
  // not shareable until someone asks, so opening the menu must not start sharing.
  const { data: link } = useAuthQuery<BrandShareToken>(
    ["brandShareToken", brand?.brandId ?? "none"],
    async () => getBrandShareToken(brand!.brandId),
    { enabled: open && !!brand },
  );

  if (!brand) return null;
  // Default-hidden: `useIsBetaUser` is false until Clerk resolves, so a non-beta
  // viewer never sees a flash of the control.
  if (!isBeta) return null;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const shareUrl = brandShareUrl(origin, link?.shareToken ?? null);

  async function handleShare() {
    if (!brand) return;
    setError(null);

    // Already shared: hand back the link we already have rather than a round
    // trip. The POST is idempotent anyway, but a copy that needs no network is
    // the difference between a click that feels instant and one that stalls.
    let url = shareUrl;
    if (!url) {
      setCreating(true);
      try {
        const created = await createBrandShareToken(brand.brandId);
        queryClient.setQueryData(["brandShareToken", brand.brandId], created);
        url = brandShareUrl(origin, created.shareToken);
      } catch (err) {
        // Never render the raw upstream body — it carries the downstream JSON
        // verbatim. The real error goes to the console.
        console.error("[dashboard] createBrandShareToken failed", err);
        setError("Could not create the link. Try again.");
        setCreating(false);
        return;
      }
      setCreating(false);
    }

    if (!url) {
      console.error("[dashboard] share link created but carried no token");
      setError("Could not create the link. Try again.");
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:text-brand-600 hover:bg-gray-100 transition"
      >
        <ShareIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
        <span className="hidden sm:inline">
          <MaturityBadge level="beta" />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-[60]"
        >
          <button
            role="menuitem"
            onClick={handleShare}
            disabled={creating}
            className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition ${
              creating ? "cursor-wait" : ""
            }`}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
            ) : (
              <LinkIcon className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
            )}
            <span className="min-w-0">
              <span className="block font-medium">
                {copied ? "Link copied" : "Share a public link (view only)"}
              </span>
              {/* Names exactly what the page shows, because the person clicking
                  is deciding what to expose. It must not promise more than
                  `/share/<token>` renders: today a credential unlocks the
                  brand's profile and nothing else. */}
              <span className="block text-xs text-gray-500 mt-0.5">
                Anyone with the link sees this brand&apos;s profile. No sign-in, no
                spend figures, nothing else in your account.
              </span>
            </span>
          </button>

          {error && (
            <p className="px-4 py-2 text-xs text-red-600 border-t border-gray-100">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
