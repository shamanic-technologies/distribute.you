// The shared Overview is the dashboard's Overview, re-exported rather than
// re-implemented. The route segments underneath the credential mirror the authed
// ones exactly, so `useParams()` inside the page resolves the same org and brand
// it always does, and there is no second copy of this page to keep in step.
export { default } from "@/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page";
