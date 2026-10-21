import { Suspense } from "react";
import { PeopleLifecyclePage } from "@/components/v2/people-lifecycle-page";

export default function V2PeopleRoute() {
  return (
    <Suspense>
      <PeopleLifecyclePage />
    </Suspense>
  );
}
