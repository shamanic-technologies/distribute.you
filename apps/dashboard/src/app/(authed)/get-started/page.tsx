import { Suspense } from "react";
import { headers } from "next/headers";
import { GetStarted } from "@/components/v2/get-started/get-started";

export default async function GetStartedPage() {
  // Cloudflare names the visitor's country on every request: the phone field opens on it.
  const ipCountry = (await headers()).get("cf-ipcountry");
  return (
    <Suspense fallback={null}>
      <GetStarted ipCountry={ipCountry} />
    </Suspense>
  );
}
