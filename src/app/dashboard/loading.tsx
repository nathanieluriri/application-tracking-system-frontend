import { KpiGridSkeleton } from "@/components/feedback/skeletons/KpiSkeleton";
import { ChartSkeleton } from "@/components/feedback/skeletons/ChartSkeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <KpiGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
