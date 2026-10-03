import { Suspense } from "react";
import { GetStarted } from "@/components/v2/get-started/get-started";

export default function GetStartedPage() {
  return (
    <Suspense fallback={null}>
      <GetStarted />
    </Suspense>
  );
}
