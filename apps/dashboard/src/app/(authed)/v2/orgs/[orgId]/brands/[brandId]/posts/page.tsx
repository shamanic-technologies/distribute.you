import { StaffOnly } from "@/components/v2/staff-only";
import { PostsPage } from "@/components/v2/posts-page";

// Posting > Posts: the brand's own LinkedIn posts, staff mode only.
export default function V2PostsRoute() {
  return (
    <StaffOnly>
      <PostsPage />
    </StaffOnly>
  );
}
