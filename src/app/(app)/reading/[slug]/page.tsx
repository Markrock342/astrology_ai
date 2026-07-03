import { redirect } from "next/navigation";

/**
 * Legacy per-category reading route. The app moved to a single chat surface on
 * /dashboard where the category is selected via `?cat=`. Keep the path working
 * by redirecting so old links (and bookmarks) don't 404.
 */
export default async function ReadingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard?cat=${encodeURIComponent(slug)}`);
}
