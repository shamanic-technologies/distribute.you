"use client";

import { useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useStaffMode } from "@/lib/use-staff-mode";

/**
 * A page that lives below a mission (workflows, models, templates, Research). A customer
 * never sees it, and neither does staff with Staff mode off: a typed URL reaches the same
 * "not available" a client would. Nothing renders until Clerk says who is reading, so a
 * staff reader never sees the refusal flash first. Once loaded it stays loaded: Clerk's
 * `isLoaded` and `user` blink during token rotation, and a gate that followed the blink
 * unmounted the whole page every minute (the latch for `user` is in staff-latch.ts).
 */
export function StaffOnly({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  const { staffMode } = useStaffMode();
  const loadedOnce = useRef(false);
  if (isLoaded) loadedOnce.current = true;
  if (!loadedOnce.current) return null;
  if (!staffMode) {
    return (
      <div className="p-4 md:p-8">
        <div className="k-card mx-auto max-w-md p-6 text-center">
          <h1 className="text-[15px] font-medium">Not available</h1>
          <p className="k-fg3 mt-1 text-[13px]">This page is not open on your account.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
