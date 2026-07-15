import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Stores the user's OPTIONAL onboarding phone number on Clerk user
 * `publicMetadata`. Clerk owns user identity, so contact info lives there (like
 * the org's `onboardingComplete` flag on `/api/onboarding/complete`) — no
 * backend service change, no SMS verification. The user id is derived from the
 * session, never trusted from the client.
 *
 * An empty national number is a valid no-op skip (the client only POSTs when
 * the user typed something).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { countryCode?: unknown; dialCode?: unknown; national?: unknown }
    | null;
  if (
    !body ||
    typeof body.countryCode !== "string" ||
    typeof body.dialCode !== "string" ||
    typeof body.national !== "string"
  ) {
    return NextResponse.json({ error: "Invalid phone payload" }, { status: 400 });
  }

  const national = body.national.trim();
  // E.164-ish: dial code + digits only. Empty stays empty (nothing to store).
  const phone = national ? `+${body.dialCode.replace(/\D/g, "")}${national.replace(/\D/g, "")}` : "";

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      phone,
      phoneCountryCode: body.countryCode,
      phoneDialCode: body.dialCode,
      phoneNational: national,
    },
  });

  return NextResponse.json({ ok: true });
}
