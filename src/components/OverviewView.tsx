import { Users, UserPlus, Calendar, Award, Clock, Briefcase, TrendingUp, CheckCircle } from "lucide-react";
import { StatCard } from "./StatCard";
import { STATS, WEEKLY_APPLICATIONS, PIPELINE_DATA, POSITION_DATA } from "@/lib/mock-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const PIE_COLORS = [
  "hsl(145, 63%, 32%)",
  "hsl(145, 63%, 45%)",
  "hsl(217, 91%, 60%)",
  "hsl(217, 70%, 75%)",
  "hsl(38, 92%, 50%)",
  "hsl(145, 40%, 70%)",
];

export function OverviewView() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">Your recruitment pipeline at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Applications" value={STATS.totalApplications} change="+12% from last month" changeType="positive" />
        <StatCard icon={UserPlus} label="New This Week" value={STATS.newThisWeek} change="+5 from last week" changeType="positive" iconColor="bg-accent/10 text-accent" />
        <StatCard icon={Calendar} label="Interviews Scheduled" value={STATS.interviewsScheduled} change="3 this week" changeType="neutral" iconColor="bg-warning/10 text-warning" />
        <StatCard icon={Award} label="Acceptance Rate" value={`${STATS.acceptanceRate}%`} change="+3% improvement" changeType="positive" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Shortlisted" value={STATS.shortlisted} iconColor="bg-accent/10 text-accent" />
        <StatCard icon={CheckCircle} label="Offers Extended" value={STATS.offersExtended} iconColor="bg-success/10 text-success" />
        <StatCard icon={Clock} label="Avg. Time to Hire" value={`${STATS.avgTimeToHire}d`} iconColor="bg-warning/10 text-warning" />
        <StatCard icon={Briefcase} label="Open Positions" value={STATS.openPositions} iconColor="bg-primary/10 text-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Applications Chart */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Applications & Hires</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={WEEKLY_APPLICATIONS} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 92%)" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 20%, 92%)", fontSize: 13 }} />
              <Bar dataKey="applications" fill="hsl(145, 63%, 32%)" radius={[4, 4, 0, 0]} name="Applications" />
              <Bar dataKey="hires" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Hires" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pipeline Breakdown</h3>
          <div className="space-y-3">
            {PIPELINE_DATA.map((item) => {
              const maxCount = Math.max(...PIPELINE_DATA.map(d => d.count));
              const width = (item.count / maxCount) * 100;
              return (
                <div key={item.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right">{item.stage}</span>
                  <div className="flex-1 bg-muted rounded-full h-7 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full flex items-center justify-end px-2 transition-all duration-500"
                      style={{ width: `${width}%` }}
                    >
                      <span className="text-xs font-medium text-primary-foreground">{item.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Positions Pie Chart */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Applications by Position</h3>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <ResponsiveContainer width="100%" height={240} className="max-w-xs">
            <PieChart>
              <Pie data={POSITION_DATA} cx="50%" cy="50%" outerRadius={95} innerRadius={55} dataKey="count" paddingAngle={2}>
                {POSITION_DATA.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {POSITION_DATA.map((item, i) => (
              <div key={item.position} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-sm text-muted-foreground">{item.position}</span>
                <span className="text-sm font-medium text-foreground ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
