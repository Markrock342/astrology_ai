import { AdminDashboardSkeleton } from "@/components/app/content-skeleton";

export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 md:p-8">
      <AdminDashboardSkeleton />
    </div>
  );
}
