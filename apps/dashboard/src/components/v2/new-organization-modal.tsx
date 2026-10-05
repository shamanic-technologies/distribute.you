"use client";

/**
 * "New organization", dashboard v2: it only NAMES and creates the org, credits its
 * creation bonus, then lands on the org's brand walk (the `/get-started` screens, signed
 * in, `v2NewBrandHref`) for its first brand. Everything after the name is that ONE walk.
 *
 * The session's active org is never switched with `setActive` here: that would refresh
 * the current page under a not-yet-set-up org and the edge gate would bounce it. A full
 * navigation to the walk instead (the edge lets a not-set-up org reach it, Clerk's URL
 * sync activates the org there). The walk makes it active once it is set up.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { suggestOrgName } from "@/lib/v2/new-org-wizard";
import { v2NewBrandHref } from "@/lib/v2/routes";

export function NewOrganizationModal({ onClose, existingOrgNames }: { onClose: () => void; existingOrgNames: readonly string[] }) {
  const { user } = useUser();
  const { session } = useSession();
  const { createOrganization } = useOrganizationList();
  const personName = user?.fullName ?? ([user?.firstName, user?.lastName].filter(Boolean).join(" ") || null);
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrgName((cur) => cur || suggestOrgName(personName, existingOrgNames));
  }, [personName, existingOrgNames]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submitOrg() {
    const name = orgName.trim();
    if (!name) return setError("Give your organization a name.");
    setBusy(true);
    setError(null);
    try {
      let id = orgId;
      if (!id) {
        if (!createOrganization) throw new Error("Your session is still loading. Try again in a moment.");
        const org = await createOrganization({ name });
        id = org.id;
        setOrgId(id);
        posthog.capture("new_org_modal_org_created", { org_id: id });
      }
      // The org's creation bonus pays for the reads that draft its first brand. Asked
      // with a token minted for the NEW org (the session is still on the previous one);
      // billing grants it once per org, so a retry after a failure is safe.
      const orgToken = await session?.getToken({ organizationId: id, skipCache: true });
      if (!orgToken) throw new Error("Your session expired. Sign in again to finish.");
      const bonus = await fetch("/api/orgs/creation-bonus", { method: "POST", headers: { Authorization: `Bearer ${orgToken}` } });
      if (!bonus.ok) throw new Error("We could not credit the new organization. Try again.");
      window.location.assign(v2NewBrandHref(id));
    } catch (e) {
      console.error("[new-org] org create failed:", e);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[8vh]">
      <div role="dialog" aria-modal="true" aria-label="New organization" className="k-popover flex w-full max-w-[480px] flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">New organization</span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>
        <form
          className="px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submitOrg();
          }}
        >
          <h2 className="k-fg text-[17px] font-medium leading-6">Name your organization</h2>
          <label className="mt-4 block">
            <span className="k-label">Organization name</span>
            <input className="k-input mt-1.5 w-full px-2.5" value={orgName} onChange={(e) => setOrgName(e.target.value)} autoFocus disabled={!!orgId} />
          </label>
          <p className="k-fg3 mt-2 text-[12px]">Next, you add its first brand.</p>
          {error && (
            <p className="mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <button type="submit" className="k-btn-strong" disabled={busy}>
              {busy ? "Creating…" : "Create organization"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    host,
  );
}
