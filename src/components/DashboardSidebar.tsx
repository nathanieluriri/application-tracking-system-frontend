import { LayoutDashboard, Users, Mail, FileText, Settings, BarChart3, BriefcaseBusiness } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "applicants", label: "Applicants", icon: Users },
  { id: "pipeline", label: "Pipeline", icon: BarChart3 },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "positions", label: "Positions", icon: BriefcaseBusiness },
  { id: "settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <BriefcaseBusiness className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-sidebar-foreground">HireBoard</h1>
          <p className="text-xs text-sidebar-muted">Recruitment Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-semibold text-sidebar-primary-foreground">
            HR
          </div>
          <div>
            <p className="text-sm font-medium text-sidebar-foreground">HR Admin</p>
            <p className="text-xs text-sidebar-muted">admin@hireboard.ng</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
