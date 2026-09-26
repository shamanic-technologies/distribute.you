import { Suspense } from "react";
import { PeoplePage } from "@/components/v2/people-page";

export default function V2PeopleRoute() {
  return (
    <Suspense>
      <PeoplePage />
    </Suspense>
  );
}
