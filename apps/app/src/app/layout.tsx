import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "distribute — App",
  description: "Cold email outreach, done for you.",
  icons: { icon: "/logo/logo-distribute.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        {/* Restore the user's saved theme before first paint (same pattern as the prod landing). */}
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute('data-theme',localStorage.getItem('dt')||'light')` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
