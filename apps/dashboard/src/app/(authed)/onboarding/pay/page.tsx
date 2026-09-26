import { redirect } from "next/navigation";

/**
 * RETIRED. This step belonged to a pay-before-the-brand flow; onboarding is one wizard
 * now, and it asks for outcomes. The route stays so
 * an old link lands somewhere real.
 */
export default function RetiredOnboardingStep() {
  redirect("/onboarding");
}
