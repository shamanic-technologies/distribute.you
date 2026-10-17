import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { GetStarted } from "@/components/v2/get-started/get-started";
import { GS_ARM_COOKIE, decideGsArm } from "@/lib/v2/get-started-arm";

export default async function GetStartedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Cloudflare names the visitor's country on every request: the phone field opens on it.
  const ipCountry = (await headers()).get("cf-ipcountry");
  // The get-started A/B arm, drawn here so the first frame already shows it (the page
  // writes the cookie once mounted). `?gs_arm=` forces one, for QA.
  const query = (await searchParams).gs_arm;
  const { arm, fresh } = decideGsArm({
    query: typeof query === "string" ? query : null,
    cookie: (await cookies()).get(GS_ARM_COOKIE)?.value,
    random: Math.random(),
  });
  return (
    <Suspense fallback={null}>
      <GetStarted ipCountry={ipCountry} gsArm={arm} gsArmFresh={fresh} />
    </Suspense>
  );
}
