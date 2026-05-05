import { Briefcase, Plus, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { POSITION_DATA } from "@/lib/mock-data";

const MOCK_POSITIONS = [
  { id: "1", title: "Frontend Developer", department: "Engineering", location: "Lagos", type: "Full-time", applicants: 42, posted: "2026-04-01", status: "open" },
  { id: "2", title: "Backend Engineer", department: "Engineering", location: "Remote", type: "Full-time", applicants: 38, posted: "2026-04-05", status: "open" },
  { id: "3", title: "UI/UX Designer", department: "Design", location: "Lagos", type: "Full-time", applicants: 28, posted: "2026-04-10", status: "open" },
  { id: "4", title: "DevOps Engineer", department: "Engineering", location: "Abuja", type: "Contract", applicants: 18, posted: "2026-04-15", status: "open" },
  { id: "5", title: "Project Manager", department: "Operations", location: "Lagos", type: "Full-time", applicants: 15, posted: "2026-04-08", status: "open" },
  { id: "6", title: "Data Analyst", department: "Analytics", location: "Remote", type: "Full-time", applicants: 15, posted: "2026-04-12", status: "closed" },
];

export function PositionsView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Open Positions</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage job listings</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Position
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_POSITIONS.map(pos => (
          <div key={pos.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <Badge variant="outline" className={pos.status === "open" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                {pos.status}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground">{pos.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{pos.department} · {pos.location} · {pos.type}</p>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {pos.applicants} applicants
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {new Date(pos.posted).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
