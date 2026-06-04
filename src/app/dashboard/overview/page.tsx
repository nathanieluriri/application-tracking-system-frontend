import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { serverFetch } from "@/lib/api/server";

interface OverviewMetrics {
  totals?: {
    total_applications?: number;
    new_this_week?: number;
    shortlisted?: number;
    interviews_scheduled?: number;
    offers_extended?: number;
    acceptance_rate?: number;
    avg_time_to_hire_days?: number;
    open_positions?: number;
  };
  pipeline_breakdown?: Array<{ stage: string; count: number }>;
  applications_by_position?: Array<{ position: string; count: number }>;
}

export default async function OverviewPage() {
  const res = await serverFetch<{ data: OverviewMetrics }>("/v1/dashboard/overview");
  const metrics =
    (res.data as unknown as { data?: OverviewMetrics } | null)?.data ?? {};
  const totals = metrics.totals ?? {};

  const kpis: Array<{ label: string; value: string | number }> = [
    { label: "Total Applications", value: totals.total_applications ?? 0 },
    { label: "New this week", value: totals.new_this_week ?? 0 },
    { label: "Shortlisted", value: totals.shortlisted ?? 0 },
    { label: "Interviews", value: totals.interviews_scheduled ?? 0 },
    { label: "Offers", value: totals.offers_extended ?? 0 },
    {
      label: "Acceptance rate",
      value: `${totals.acceptance_rate ?? 0}%`,
    },
    {
      label: "Avg time to hire",
      value: `${totals.avg_time_to_hire_days ?? 0} days`,
    },
    { label: "Open positions", value: totals.open_positions ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Your hiring pipeline at a glance.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-3xl font-semibold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(metrics.pipeline_breakdown ?? []).map((row) => (
              <div key={row.stage} className="flex justify-between text-sm">
                <span className="capitalize text-muted-foreground">{row.stage}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
            {(metrics.pipeline_breakdown ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Applications by position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(metrics.applications_by_position ?? []).map((row) => (
              <div key={row.position} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{row.position}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
            {(metrics.applications_by_position ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
