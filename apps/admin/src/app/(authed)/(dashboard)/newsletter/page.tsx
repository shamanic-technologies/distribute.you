"use client";

import { ReleaseConsole } from "@/components/newsletter/release-console";

export default function NewsletterPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Newsletter</h1>
        <p className="mt-1 text-sm text-gray-500">
          One written update, released to the newsletter list over several days at a pace you set.
          Nobody is mailed twice, a restart loses nobody, and somebody who unsubscribes on day one
          is skipped on day five. It stops itself if delivery outcomes go bad — and you can stop it
          yourself here, from anywhere.
        </p>
      </div>

      <ReleaseConsole />
    </div>
  );
}
