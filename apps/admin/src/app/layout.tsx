import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin | distribute",
  description: "Internal admin panel for distribute services",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased min-h-screen">
          <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
            <a href="/" className="text-lg font-bold text-gray-900">
              admin<span className="text-blue-600">.distribute.you</span>
            </a>
          </header>
          <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}
