"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ORG_DESYNC_EVENT, orgDesyncMessage, type OrgDesyncInfo } from "@/lib/org-desync";

/**
 * Says which org is open when the page names another one and `apiCall` gave up retrying
 * (409 `org_desync`): a link carrying an org the session is not on, or one the person is
 * not a member of. Without it every surface showed its own generic "try again"
 * (2026-11-07, LinkedIn connect). Reload lets the edge switch the session to the page's
 * org when the person belongs to it; the link opens the org they are signed in to.
 */
export function OrgDesyncNotice() {
  const [info, setInfo] = useState<OrgDesyncInfo | null>(null);

  useEffect(() => {
    const onDesync = (e: Event) => setInfo((e as CustomEvent<OrgDesyncInfo>).detail ?? null);
    window.addEventListener(ORG_DESYNC_EVENT, onDesync);
    return () => window.removeEventListener(ORG_DESYNC_EVENT, onDesync);
  }, []);

  if (!info) return null;
  // Portalled into the shell's `#v2-portal` (inside `.v2-root`, where the k-* tokens apply).
  const host = document.getElementById("v2-portal");
  if (!host) return null;
  return createPortal(
    <div
      role="alert"
      className="k-popover fixed left-1/2 top-3 z-[90] flex w-[min(560px,calc(100vw-16px))] -translate-x-1/2 items-center gap-3 px-4 py-3"
    >
      <p className="k-fg min-w-0 flex-1 text-[13px] leading-5">{orgDesyncMessage(info.sessionOrgName)}</p>
      <button type="button" className="k-btn shrink-0" onClick={() => window.location.reload()}>
        Reload
      </button>
      {info.sessionOrgId && (
        <a className="k-btn-strong shrink-0" href={`/v2/orgs/${encodeURIComponent(info.sessionOrgId)}`}>
          {info.sessionOrgName ? `Open ${info.sessionOrgName}` : "Open my organization"}
        </a>
      )}
      <button type="button" aria-label="Close" className="k-btn-ghost shrink-0 px-2" onClick={() => setInfo(null)}>
        ×
      </button>
    </div>,
    host,
  );
}
