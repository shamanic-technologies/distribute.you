"use client";

import AccountPage from "@/components/settings/account-profile";
import { V2AccountFrame } from "@/components/v2/setup-pages";
import { MyLinkedinPosts } from "@/components/v2/my-linkedin-posts";
import { TelegramUpdatesCard } from "@/components/v2/telegram-updates-card";

export default function Page() {
  return (
    <>
      <V2AccountFrame label="Profile">
        <AccountPage />
      </V2AccountFrame>
      {/* Every member links the org's Telegram updates themselves: v2-native, below the profile cards. */}
      <section className="mx-auto max-w-2xl px-4 pb-8 md:px-8">
        <TelegramUpdatesCard />
      </section>
      {/* Staff mode only, v2-native, so outside the v1 embed layer. */}
      <MyLinkedinPosts />
    </>
  );
}
