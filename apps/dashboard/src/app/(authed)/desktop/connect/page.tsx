import type { Metadata } from "next";
import { Suspense } from "react";
import { DesktopConnectClient } from "./desktop-connect";

export const metadata: Metadata = {
  title: "Connect distribute for Mac",
  robots: { index: false, follow: false },
};

export default function DesktopConnectPage() {
  return (
    <Suspense fallback={null}>
      <DesktopConnectClient />
    </Suspense>
  );
}
