"use client";

import { createContext, useContext } from "react";

/**
 * Whether the surrounding tree is the PUBLIC, read-only share view.
 *
 * The share tree renders the very same page components as the authed dashboard —
 * that is the whole point, one Audiences page rather than two that drift. So the
 * pages need one question they can ask: "is anyone allowed to change this?".
 *
 * The default is `null`, meaning "not a share view", so every existing authed
 * render is untouched and no page has to be wrapped in anything new. Only the
 * share tree mounts the provider.
 *
 * This flag is a DISPLAY concern and never a security boundary. What a share
 * visitor may actually reach is decided server-side, by a proxy that exports no
 * verb but GET and pins every read to one brand. A control this flag forgets to
 * hide still cannot write.
 */
export interface ShareModeValue {
  token: string;
  orgId: string;
  brandId: string;
  brandName: string;
  brandDomain: string | null;
}

const ShareModeContext = createContext<ShareModeValue | null>(null);

export function ShareModeProvider({
  value,
  children,
}: {
  value: ShareModeValue;
  children: React.ReactNode;
}) {
  return <ShareModeContext.Provider value={value}>{children}</ShareModeContext.Provider>;
}

/** The share view's identity, or null in the authed dashboard. */
export function useShareMode(): ShareModeValue | null {
  return useContext(ShareModeContext);
}

/** True only inside the public share view. */
export function useIsShareMode(): boolean {
  return useContext(ShareModeContext) !== null;
}

/**
 * What to put in front of an in-app `/orgs/…` link so it stays where the reader
 * already is.
 *
 * The share tree mirrors the authed routes under the credential, so a link built
 * as `/orgs/<org>/brands/<brand>/audiences` is correct in the dashboard and lands
 * a share visitor on a sign-in page. Prefixing is the whole fix: `""` in the
 * dashboard, `/share/<token>` on a shared link.
 */
export function useSharePathPrefix(): string {
  const share = useContext(ShareModeContext);
  return share ? `/share/${encodeURIComponent(share.token)}` : "";
}
