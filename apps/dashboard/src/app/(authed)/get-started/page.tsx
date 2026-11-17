import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { GetStarted } from "@/components/v2/get-started/get-started";
import { DISTRY_SKIN_COOKIE, DistrySkin, DistrySkinOff, wearsDistrySkin } from "@/components/v2/get-started/distry-skin";
import { GS_ARM_COOKIE, decideGsArm } from "@/lib/v2/get-started-arm";
import { gsArmWeights } from "@/lib/v2/get-started-arm-split";

export default async function GetStartedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Cloudflare names the visitor's country on every request: the phone field opens on it.
  const ipCountry = (await headers()).get("cf-ipcountry");
  // The get-started A/B arm, drawn here so the first frame already shows it (the page
  // writes the cookie once mounted). `?gs_arm=` forces one, for QA. A new visitor is drawn
  // with the adaptive split (lib/v2/get-started-arm-split.ts, owner 2026-10-22).
  const params = await searchParams;
  const query = params.gs_arm;
  // The Distry skin, a private switch for review (`?skin=distry`, remembered; `?skin=off`).
  const skinQuery = typeof params.skin === "string" ? params.skin : null;
  const skin = wearsDistrySkin(skinQuery, (await cookies()).get(DISTRY_SKIN_COOKIE)?.value);
  const { arm, fresh } = decideGsArm({
    query: typeof query === "string" ? query : null,
    cookie: (await cookies()).get(GS_ARM_COOKIE)?.value,
    random: Math.random(),
    weights: gsArmWeights(),
  });
  return (
    <>
      {skin ? <DistrySkin /> : skinQuery !== null ? <DistrySkinOff /> : null}
      <Suspense fallback={null}>
        <GetStarted ipCountry={ipCountry} gsArm={arm} gsArmFresh={fresh} />
      </Suspense>
    </>
  );
}
