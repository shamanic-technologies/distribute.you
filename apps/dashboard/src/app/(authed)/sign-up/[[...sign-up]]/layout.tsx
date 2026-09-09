import type { Metadata } from "next";
import { AdsSignUpPageTracker } from "@/components/ads-signup-page-tracker";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your distribute.you account to start automating your distribution in minutes.",
  robots: { index: false, follow: false },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  // Mounted on the LAYOUT rather than inside the page: the page is one large
  // client component whose render branches over several steps (form, verify,
  // resend), and a tracker parked in one of those branches would fire on some
  // arrivals and not others. The layout renders once per visit to the route.
  return (
    <>
      <AdsSignUpPageTracker />
      {children}
    </>
  );
}
