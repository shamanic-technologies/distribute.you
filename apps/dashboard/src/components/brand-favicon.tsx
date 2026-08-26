"use client";

import { useEffect } from "react";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";

// Same publishable logo.dev key every other logo surface uses (`BrandLogo`,
// `OrgAvatar`, the billing card networks, the leads panel). The tab mark and the
// switcher mark must come from ONE source or they drift.
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** Marks the `<link>` this component owns, so it never neutralises its own tag. */
const MANAGED_ATTR = "data-brand-favicon";
/** Parks the app's own icon `rel` while a brand mark is showing. */
const PARKED_ATTR = "data-brand-favicon-parked";

function brandFaviconSrc(domain: string): string {
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=64&format=png&retina=true`;
}

/**
 * Put the distribute mark back: drop our link, un-park the app's own ones.
 *
 * Parking (blanking `rel`) rather than appending a second icon link is
 * deliberate — which of several `<link rel="icon">` a browser picks is not
 * specified, so "append and hope it wins" renders differently per browser.
 */
function restoreDefaultFavicon(): void {
  document.querySelectorAll(`link[${MANAGED_ATTR}]`).forEach((link) => link.remove());
  document.querySelectorAll<HTMLLinkElement>(`link[${PARKED_ATTR}]`).forEach((link) => {
    link.rel = link.getAttribute(PARKED_ATTR) || "icon";
    link.removeAttribute(PARKED_ATTR);
  });
}

function applyBrandFavicon(src: string): void {
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((link) => {
    if (link.hasAttribute(MANAGED_ATTR)) return;
    link.setAttribute(PARKED_ATTR, link.rel);
    link.rel = "";
  });
  document.querySelectorAll(`link[${MANAGED_ATTR}]`).forEach((link) => link.remove());

  const link = document.createElement("link");
  link.setAttribute(MANAGED_ATTR, "");
  link.rel = "icon";
  link.type = "image/png";
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Is the brand mark the ONLY live icon link, and is it ours?
 *
 * Both halves matter. A live sibling means the browser is free to pick the
 * distribute mark instead (which of several it takes is unspecified), and a
 * live-but-not-ours link means somebody else rewrote the head. Also the guard
 * that stops the observer below re-entering: after an apply this reads true, so
 * the mutations the apply itself caused settle instead of looping.
 */
function brandFaviconHolds(src: string): boolean {
  const live = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  return (
    live.length === 1 &&
    live[0].hasAttribute(MANAGED_ATTR) &&
    live[0].getAttribute("href") === src
  );
}

/**
 * Browser-tab favicon = the logo of the brand currently open.
 *
 * The brand comes from the shared tenant switcher (`displayBrand`), i.e. the URL
 * `/orgs/:orgId/brands/:brandId` — the per-tab source of truth, never Clerk's
 * shared active org. Its two reads (`["brands"]`, `["brand", brandId]`) are the
 * same disk-backed React Query keys the sidebar already holds, so this adds no
 * request and resolves on the first frame.
 *
 * The swap only happens once the image has actually decoded. logo.dev answers a
 * domain it doesn't know with a generated monogram, and a brand can have no
 * domain at all — in both cases the distribute mark is the right tab icon, so a
 * failed load keeps it (and says so in the console) rather than shipping a
 * placeholder that reads like a real logo.
 *
 * ⚠️ The swap is ASSERTED, not applied once, and that is the whole fix for the
 * mark flipping back to the distribute one mid-session. The app's own icon links
 * are rendered by Next from the root layout's `metadata.icons`, so REACT owns
 * those DOM nodes: a client navigation re-renders them and the `rel` we blanked
 * comes back, leaving two live icon links and letting the browser fall back to
 * the distribute mark. The brand domain has not changed, so the effect never
 * re-runs and it never recovers — which is exactly why it read as random
 * ("sometimes the brand, sometimes distribute"). A `MutationObserver` on the
 * head re-parks whatever came back. Deliberately mechanism-agnostic: it holds
 * for a React re-render, a Next re-insert, or any future head writer, none of
 * which announce themselves.
 */
export function BrandFavicon() {
  const { displayBrand } = useTenantSwitcher();
  const domain = displayBrand?.domain ?? null;

  useEffect(() => {
    if (!domain) {
      restoreDefaultFavicon();
      return;
    }

    const src = brandFaviconSrc(domain);
    let cancelled = false;
    let observer: MutationObserver | null = null;
    const probe = new Image();

    probe.onload = () => {
      if (cancelled) return;
      applyBrandFavicon(src);
      observer = new MutationObserver(() => {
        if (cancelled || brandFaviconHolds(src)) return;
        applyBrandFavicon(src);
      });
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["rel", "href"],
      });
    };
    probe.onerror = () => {
      console.error(`[dashboard] No logo for "${domain}" — keeping the distribute tab mark`);
      if (!cancelled) restoreDefaultFavicon();
    };
    probe.src = src;

    return () => {
      cancelled = true;
      observer?.disconnect();
      probe.onload = null;
      probe.onerror = null;
      restoreDefaultFavicon();
    };
  }, [domain]);

  return null;
}
