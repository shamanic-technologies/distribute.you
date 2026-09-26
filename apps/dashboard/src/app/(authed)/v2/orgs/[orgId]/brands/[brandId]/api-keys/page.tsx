"use client";

import ApiKeysPage from "@/app/(authed)/(dashboard)/orgs/[orgId]/api-keys/page";
import { V2AccountFrame } from "@/components/v2/setup-pages";

export default function Page() {
  return (
    <V2AccountFrame label="API key">
      <ApiKeysPage />
    </V2AccountFrame>
  );
}
