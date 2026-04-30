import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AdminHeader } from "@/components/admin-header";
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
          <AdminHeader />
          <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}
