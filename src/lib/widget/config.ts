import type { WidgetRenderConfig, WidgetRole } from "./runtime";

/**
 * Client-side widget config types + defaults (mirrors the server `WidgetOut`
 * shape). Defined here — not imported from `@server` — to keep the dashboard
 * client bundle free of server/Mongo deps.
 */

export type WidgetLayout = "list" | "grid" | "compact";
export type WidgetStatus = "active" | "disabled";
export type ThemeMode = "dark" | "light" | "auto";
export type FontChoice = "system" | "inherit";

export interface WidgetConfig {
  id?: string | null;
  name: string;
  status: WidgetStatus;
  layout: WidgetLayout;
  theme: {
    mode: ThemeMode;
    accent: string;
    background: string | null;
    radius: number;
    font: FontChoice;
  };
  content: {
    show_header: boolean;
    heading: string;
    subtitle: string;
    cta_label: string;
    show_view_all: boolean;
    view_all_label: string;
    view_all_url: string | null;
    fields: {
      department: boolean;
      location: boolean;
      employment_type: boolean;
      posted_date: boolean;
    };
  };
  filters: {
    departments: string[];
    locations: string[];
    employment_types: string[];
    max_roles: number;
  };
  behavior: {
    enable_search: boolean;
    enable_filters: boolean;
    open_in_new_tab: boolean;
  };
}

export function defaultWidgetConfig(name = "Untitled widget"): WidgetConfig {
  return {
    name,
    status: "active",
    layout: "list",
    theme: { mode: "dark", accent: "#ffffff", background: null, radius: 14, font: "system" },
    content: {
      show_header: true,
      heading: "Featured roles",
      subtitle: "We're always seeking talented individuals to join our team.",
      cta_label: "Apply now",
      show_view_all: true,
      view_all_label: "View open roles",
      view_all_url: null,
      fields: { department: true, location: true, employment_type: false, posted_date: false },
    },
    filters: { departments: [], locations: [], employment_types: [], max_roles: 10 },
    behavior: { enable_search: false, enable_filters: false, open_in_new_tab: true },
  };
}

/** The render-safe subset the runtime consumes (no name/filters/status-internal). */
export function toRenderConfig(c: WidgetConfig): WidgetRenderConfig {
  return {
    id: c.id,
    status: c.status,
    layout: c.layout,
    theme: c.theme,
    content: c.content,
    behavior: c.behavior,
  };
}

/** Mirror of the server `selectWidgetRoles` for the live preview (pure). */
export function previewRoles(roles: WidgetRole[], c: WidgetConfig): WidgetRole[] {
  const f = c.filters;
  let out = roles.filter((r) => {
    if (f.departments.length && !f.departments.includes(r.department ?? "")) return false;
    if (f.locations.length && !f.locations.includes(r.location ?? "")) return false;
    if (f.employment_types.length && !f.employment_types.includes(r.employment_type ?? "")) {
      return false;
    }
    return true;
  });
  if (f.max_roles && f.max_roles > 0) out = out.slice(0, f.max_roles);
  return out;
}

export const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];
