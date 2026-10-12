import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import "@/components/v2/keel.css";

// Keel's pairing, scoped to this route through CSS variables like the v2 layout.
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Get started | distribute.you",
  robots: { index: false, follow: false },
};

/**
 * Onboarding v2 (`/get-started`): public, signed out, in the dashboard v2 language.
 * No data provider: every read is a direct call through the anonymous proxy.
 */
export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return (
    // overflow-x-clip: nothing on this walk may scroll a phone sideways (clip keeps sticky working).
    <div className={`${sans.variable} ${mono.variable} overflow-x-clip`}>
      <div className="v2-root">{children}</div>
    </div>
  );
}
