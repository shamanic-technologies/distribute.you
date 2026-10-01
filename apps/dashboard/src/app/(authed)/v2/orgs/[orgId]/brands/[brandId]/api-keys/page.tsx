"use client";

import ApiKeysPage from "@/components/settings/api-keys-panel";
import { V2AccountFrame } from "@/components/v2/setup-pages";

export default function Page() {
  return (
    <V2AccountFrame label="API Keys">
      <ApiKeysPage />
    </V2AccountFrame>
  );
}
