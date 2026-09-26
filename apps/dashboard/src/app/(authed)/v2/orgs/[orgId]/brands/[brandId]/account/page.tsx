"use client";

import AccountPage from "@/app/(authed)/(dashboard)/account/page";
import { V2AccountFrame } from "@/components/v2/setup-pages";

export default function Page() {
  return (
    <V2AccountFrame label="Profile">
      <AccountPage />
    </V2AccountFrame>
  );
}
