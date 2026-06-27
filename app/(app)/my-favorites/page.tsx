import { redirect } from "next/navigation";

/**
 * The saved-favorites list merged into the unified `/favorites` page
 * (Spec 07). This route is kept only so existing links/bookmarks resolve —
 * it permanently redirects to `/favorites`.
 */
export default function MyFavoritesPage() {
  redirect("/favorites");
}
