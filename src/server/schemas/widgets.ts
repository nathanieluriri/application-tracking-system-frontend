import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Embeddable job-widget config schemas. Ports the FastAPI `widget_schema.py`
 * shapes/defaults to TS (zod for partial request validation; defaults applied
 * in `widgetCreateDoc`). Defaults mirror the approved reference design.
 */

export const layoutValues = ["list", "grid", "compact"] as const;
export const themeModeValues = ["dark", "light", "auto"] as const;
export const fontValues = ["system", "inherit"] as const;
export const widgetStatusValues = ["active", "disabled"] as const;
export const employmentTypeValues = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
] as const;

export interface ThemeConfig {
  mode: (typeof themeModeValues)[number];
  accent: string;
  background: string | null;
  radius: number;
  font: (typeof fontValues)[number];
}
export interface FieldsConfig {
  department: boolean;
  location: boolean;
  employment_type: boolean;
  posted_date: boolean;
}
export interface ContentConfig {
  show_header: boolean;
  heading: string;
  subtitle: string;
  cta_label: string;
  show_view_all: boolean;
  view_all_label: string;
  view_all_url: string | null;
  fields: FieldsConfig;
}
export interface FiltersConfig {
  departments: string[];
  locations: string[];
  employment_types: string[];
  max_roles: number;
}
export interface BehaviorConfig {
  enable_search: boolean;
  enable_filters: boolean;
  open_in_new_tab: boolean;
}

export interface WidgetDoc {
  name: string;
  status: (typeof widgetStatusValues)[number];
  layout: (typeof layoutValues)[number];
  theme: ThemeConfig;
  content: ContentConfig;
  filters: FiltersConfig;
  behavior: BehaviorConfig;
  created_by: string | null;
  date_created: number;
  last_updated: number;
}
export interface WidgetOut extends WidgetDoc {
  id: string | null;
}

export function defaultTheme(): ThemeConfig {
  return { mode: "dark", accent: "#ffffff", background: null, radius: 14, font: "system" };
}
export function defaultFields(): FieldsConfig {
  return { department: true, location: true, employment_type: false, posted_date: false };
}
export function defaultContent(): ContentConfig {
  return {
    show_header: true,
    heading: "Featured roles",
    subtitle: "We're always seeking talented individuals to join our team.",
    cta_label: "Apply now",
    show_view_all: true,
    view_all_label: "View open roles",
    view_all_url: null,
    fields: defaultFields(),
  };
}
export function defaultFilters(): FiltersConfig {
  return { departments: [], locations: [], employment_types: [], max_roles: 10 };
}
export function defaultBehavior(): BehaviorConfig {
  return { enable_search: false, enable_filters: false, open_in_new_tab: true };
}

// --- zod request schemas (all fields optional; defaults applied server-side) ---
const themeSchema = z.object({
  mode: z.enum(themeModeValues).optional(),
  accent: z.string().optional(),
  background: z.string().nullable().optional(),
  radius: z.number().int().min(0).max(64).optional(),
  font: z.enum(fontValues).optional(),
});
const fieldsSchema = z.object({
  department: z.boolean().optional(),
  location: z.boolean().optional(),
  employment_type: z.boolean().optional(),
  posted_date: z.boolean().optional(),
});
const contentSchema = z.object({
  show_header: z.boolean().optional(),
  heading: z.string().optional(),
  subtitle: z.string().optional(),
  cta_label: z.string().optional(),
  show_view_all: z.boolean().optional(),
  view_all_label: z.string().optional(),
  view_all_url: z.string().nullable().optional(),
  fields: fieldsSchema.optional(),
});
const filtersSchema = z.object({
  departments: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  employment_types: z.array(z.enum(employmentTypeValues)).optional(),
  max_roles: z.number().int().min(0).optional(),
});
const behaviorSchema = z.object({
  enable_search: z.boolean().optional(),
  enable_filters: z.boolean().optional(),
  open_in_new_tab: z.boolean().optional(),
});

export const widgetCreateSchema = z.object({
  name: z.string().min(1),
  status: z.enum(widgetStatusValues).optional(),
  layout: z.enum(layoutValues).optional(),
  theme: themeSchema.optional(),
  content: contentSchema.optional(),
  filters: filtersSchema.optional(),
  behavior: behaviorSchema.optional(),
});
export type WidgetCreateInput = z.infer<typeof widgetCreateSchema>;

export const widgetUpdateSchema = widgetCreateSchema.partial();
export type WidgetUpdateInput = z.infer<typeof widgetUpdateSchema>;

function mergeContent(input?: WidgetCreateInput["content"]): ContentConfig {
  const base = defaultContent();
  if (!input) return base;
  return {
    ...base,
    ...input,
    fields: { ...base.fields, ...(input.fields ?? {}) },
  };
}

export function buildWidgetConfig(input: WidgetCreateInput): Omit<WidgetDoc, "created_by" | "date_created" | "last_updated"> {
  return {
    name: input.name,
    status: input.status ?? "active",
    layout: input.layout ?? "list",
    theme: { ...defaultTheme(), ...(input.theme ?? {}) },
    content: mergeContent(input.content),
    filters: { ...defaultFilters(), ...(input.filters ?? {}) },
    behavior: { ...defaultBehavior(), ...(input.behavior ?? {}) },
  };
}

export function widgetCreateDoc(input: WidgetCreateInput, createdBy: string | null): WidgetDoc {
  return {
    ...buildWidgetConfig(input),
    created_by: createdBy,
    date_created: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

/** Build a `$set` for partial updates, deep-merging nested config objects. */
export function widgetUpdateSet(input: WidgetUpdateInput): Record<string, unknown> {
  const set: Record<string, unknown> = { last_updated: nowSeconds() };
  if (input.name !== undefined) set.name = input.name;
  if (input.status !== undefined) set.status = input.status;
  if (input.layout !== undefined) set.layout = input.layout;
  if (input.theme !== undefined) set.theme = input.theme;
  if (input.content !== undefined) set.content = input.content;
  if (input.filters !== undefined) set.filters = input.filters;
  if (input.behavior !== undefined) set.behavior = input.behavior;
  return set;
}

export function widgetOut(doc: Record<string, any>): WidgetOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    name: doc.name,
    status: doc.status ?? "active",
    layout: doc.layout ?? "list",
    theme: { ...defaultTheme(), ...(doc.theme ?? {}) },
    content: mergeContent(doc.content),
    filters: { ...defaultFilters(), ...(doc.filters ?? {}) },
    behavior: { ...defaultBehavior(), ...(doc.behavior ?? {}) },
    created_by: doc.created_by ?? null,
    date_created: doc.date_created ?? null,
    last_updated: doc.last_updated ?? null,
  };
}

/** Render-safe subset returned to the public (no created_by/timestamps). */
export function widgetRenderConfig(w: WidgetOut): Record<string, unknown> {
  return {
    id: w.id,
    name: w.name,
    status: w.status,
    layout: w.layout,
    theme: w.theme,
    content: w.content,
    behavior: w.behavior,
  };
}
