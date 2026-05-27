"use client";

/**
 * Client-side invite + waitlist API callers.
 * All routes target api-service. URL contract locked in DIS-64.
 */

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export interface ValidateResponse {
  valid: boolean;
  inviterOrgName?: string;
}

export interface WaitlistResponse {
  ok: true;
  position: number;
}

export async function validateInvite(code: string): Promise<ValidateResponse> {
  const res = await fetch(`${API_URL}/v1/invites/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error(`validate failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function requestWaitlistAccess(input: {
  email: string;
  brandUrl: string;
}): Promise<WaitlistResponse> {
  const res = await fetch(`${API_URL}/v1/waitlist/request-access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`waitlist request failed: HTTP ${res.status}`);
  }
  return res.json();
}
