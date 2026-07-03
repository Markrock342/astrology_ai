import { redirect } from "next/navigation";

/** Legacy route — threads open on the dashboard chat surface. */
export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard?thread=${id}`);
}
