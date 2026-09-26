"use client";

import { useState } from "react";
import type { Lead } from "@/lib/api";
import { Initials } from "@/components/v2/ui";
import { v2PersonHref } from "@/lib/v2/routes";

// The publishable logo.dev token the dashboard already ships (company-logo.tsx).
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** How v2 names a person and their company, from the lead row lead-service serves. */
export function leadName(lead: Lead): string {
  const p = lead.lead;
  return `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() || lead.email;
}
export function leadCompany(lead: Lead): string | null {
  return lead.lead?.organization?.name ?? null;
}
export function leadCompanyDomain(lead: Lead): string | null {
  return lead.lead?.organization?.primaryDomain ?? null;
}
export function leadTitle(lead: Lead): string | null {
  return lead.lead?.currentTitle ?? lead.lead?.headline ?? null;
}

/** One person's own v2 page. */
export function personHref(orgId: string, brandId: string, lead: Lead): string {
  return v2PersonHref(orgId, brandId, lead.id);
}

/** A person: their photo when lead-service holds one that loads, else initials. */
export function PersonAvatar({ lead, size = 20 }: { lead: Lead; size?: number }) {
  const [broken, setBroken] = useState(false);
  const url = lead.lead?.photoUrl;
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Initials name={leadName(lead)} size={size} round />;
}

/** A company: logo.dev on its domain when one resolves, else initials. */
export function CompanyMark({ name, domain, size = 20 }: { name: string; domain: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (domain && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=${size * 2}&fallback=404`}
        alt=""
        onError={() => setBroken(true)}
        className="shrink-0 rounded-[5px] bg-white object-contain shadow-[inset_0_0_0_1px_var(--line-subtle)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Initials name={name} size={size} />;
}
