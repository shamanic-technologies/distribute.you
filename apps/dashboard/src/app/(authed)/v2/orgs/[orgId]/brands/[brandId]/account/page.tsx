"use client";

import AccountPage from "@/components/settings/account-profile";
import { V2AccountFrame } from "@/components/v2/setup-pages";

export default function Page() {
  return (
    <V2AccountFrame label="Profile">
      <AccountPage />
    </V2AccountFrame>
  );
}
