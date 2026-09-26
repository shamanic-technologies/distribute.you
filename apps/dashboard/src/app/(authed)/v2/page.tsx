import { redirect } from "next/navigation";

/** `/v2` names no tenant; `/orgs` resolves one, and the edge carries a v2 user on. */
export default function V2RootPage() {
  redirect("/orgs");
}
