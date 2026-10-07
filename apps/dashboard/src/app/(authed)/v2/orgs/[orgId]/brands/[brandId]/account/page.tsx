"use client";

import AccountPage from "@/components/settings/account-profile";
import { V2AccountFrame } from "@/components/v2/setup-pages";
import { MyLinkedinPosts } from "@/components/v2/my-linkedin-posts";

export default function Page() {
  return (
    <>
      <V2AccountFrame label="Profile">
        <AccountPage />
      </V2AccountFrame>
      {/* Staff mode only, v2-native, so outside the v1 embed layer. */}
      <MyLinkedinPosts />
    </>
  );
}
