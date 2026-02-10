"use client";

import { useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

export function BrandLogo({
  domain,
  size = 24,
  className,
  fallbackClassName,
}: {
  domain: string;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <GlobeAltIcon
        className={fallbackClassName || className}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`}
      alt={domain}
      width={size}
      height={size}
      className={className || "rounded"}
      onError={() => setError(true)}
    />
  );
}
