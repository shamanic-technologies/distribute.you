"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ProviderKeysRedirect() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  useEffect(() => {
    router.replace(`/orgs/${orgId}/api-keys`);
  }, [orgId, router]);

  return null;
}
