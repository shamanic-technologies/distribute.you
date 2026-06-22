"use client";

import { useRef, useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { ChevronDownIcon, ArrowRightStartOnRectangleIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

export function OnboardingAccountWidget() {
  const { user, isLoaded } = useUser();
  const { signOut, redirectToSignIn } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!isLoaded || !user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const avatar = user.imageUrl;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {email.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[180px] truncate text-gray-700 sm:block">{email}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[200px] rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2 sm:hidden">
            <p className="truncate text-xs text-gray-500">{email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); void signOut({ redirectUrl: "/" }); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4 text-gray-400" />
            Sign out
          </button>
          <button
            onClick={() => { setOpen(false); void signOut().then(() => redirectToSignIn()); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowsRightLeftIcon className="h-4 w-4 text-gray-400" />
            Switch account
          </button>
        </div>
      )}
    </div>
  );
}
