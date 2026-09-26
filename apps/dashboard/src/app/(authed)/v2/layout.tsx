import { Geist, Geist_Mono } from "next/font/google";
import "@/components/v2/keel.css";
import { V2ClientLayout } from "@/components/v2/v2-client-layout";

// Keel's own pairing. Scoped to the v2 tree through CSS variables, so v1 keeps Inter.
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

/**
 * Dashboard v2 (beta). A server wrapper only so the fonts and the scoped stylesheet
 * load here; everything else is the client layout (beta gate + v1's data providers).
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sans.variable} ${mono.variable}`}>
      <V2ClientLayout>{children}</V2ClientLayout>
    </div>
  );
}
