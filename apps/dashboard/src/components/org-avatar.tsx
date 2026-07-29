"use client";

import { useState } from "react";
import { orgDomainFromName } from "@/lib/use-tenant-switcher";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** Organization avatar. Resolution order:
 *  1. A real *uploaded* Clerk logo (`hasImage` — Clerk's `imageUrl` is ALWAYS
 *     populated, defaulting to a generated gradient-initials avatar we don't want).
 *  2. logo.dev keyed on the org's domain-shaped name.
 *  3. The org's initial.
 *  Plain `<img>` — no Next/Image domain config needed, mirrors lead photos. */
export function OrgAvatar({
  name,
  imageUrl,
  hasImage,
  sizeClass,
}: {
  name: string;
  imageUrl?: string | null;
  hasImage?: boolean;
  sizeClass: string;
}) {
  const [broken, setBroken] = useState(false);
  const domain = orgDomainFromName(name);
  const src = hasImage && imageUrl
    ? imageUrl
    : domain
      ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`
      : null;
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={`${sizeClass} rounded object-cover bg-brand-100 flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${sizeClass} bg-brand-100 rounded flex items-center justify-center flex-shrink-0`}>
      <span className="text-brand-600 font-semibold text-xs">{name?.[0]?.toUpperCase() || "O"}</span>
    </div>
  );
}
