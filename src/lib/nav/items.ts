import {
  LayoutDashboard,
  Users,
  GitBranch,
  Mail,
  FileText,
  Briefcase,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Used to mark active when pathname starts with any of these prefixes */
  match?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  {
    label: "Applicants",
    href: "/dashboard/applicants",
    icon: Users,
    match: ["/dashboard/applicants"],
  },
  {
    label: "Pipeline",
    href: "/dashboard/pipeline",
    icon: GitBranch,
  },
  {
    label: "Emails",
    href: "/dashboard/emails",
    icon: Mail,
    match: ["/dashboard/emails"],
  },
  {
    label: "Templates",
    href: "/dashboard/templates",
    icon: FileText,
    match: ["/dashboard/templates"],
  },
  {
    label: "Positions",
    href: "/dashboard/positions",
    icon: Briefcase,
    match: ["/dashboard/positions"],
  },
  {
    label: "Widgets",
    href: "/dashboard/widgets",
    icon: LayoutGrid,
    match: ["/dashboard/widgets"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    match: ["/dashboard/settings"],
  },
];
