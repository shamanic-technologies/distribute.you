import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { phoneSyntaxProblem, toE164 } from "@/lib/phone-syntax";

/**
 * Stores the user's OPTIONAL onboarding phone number on Clerk user
 * `publicMetadata`. Clerk owns user identity, so contact info lives there (like
 * the org's `onboardingComplete` flag on `/api/onboarding/complete`) — no
 * backend service change, no SMS verification. The user id is derived from the
 * session, never trusted from the client.
 *
 * An empty national number is a valid no-op skip (the client only POSTs when
 * the user typed something).
 *
 * The SYNTAX is checked here as well as in the step, through the same module.
 * The step blocking Continue is a display decision; this is the one a caller
 * cannot go around, and it is what stops an impossible number reaching Clerk.
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

  const problem = phoneSyntaxProblem({ dialCode: body.dialCode, national });
  if (problem) {
    // The sentence the step would have shown, so a caller reaching this route
    // directly learns the same thing rather than a bare "invalid".
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  // Strict E.164. Empty stays empty (nothing to store).
  const phone = toE164({ dialCode: body.dialCode, national });

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
