"use client";

/**
 * ONE audience's face — the generated image when there is one, initials otherwise.
 *
 * Extracted from `customer-audiences-page` when the campaign Workflows panel started
 * listing the audiences behind a workflow's rank: a second copy is how one audience
 * comes to wear two different marks on two screens, and the page it lived in is 75KB of
 * unrelated surface for a workflows panel to import.
 *
 * `size` is a STYLE, not a class — a Tailwind class assembled from a prop is invisible
 * to the compiler, which is why every sized mark in this app does it this way.
 */

import { useState } from "react";

export function audienceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export function AudienceAvatar({
  name,
  avatarUrl,
  size = 28,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const box = { width: size, height: size };
  if (avatarUrl && !error) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={box}
        onError={() => setError(true)}
        className="shrink-0 rounded-full border border-gray-200 object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.32)) }}
      className="flex shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 font-semibold text-brand-700"
    >
      {audienceInitials(name)}
    </span>
  );
}
