"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  type WidgetConfig,
  type WidgetLayout,
  type ThemeMode,
  EMPLOYMENT_TYPES,
} from "@/lib/widget/config";
import { WidgetPreview } from "./WidgetPreview";
import { WidgetBuilderSkeleton } from "./WidgetBuilderSkeleton";
import { EmbedSnippet } from "./EmbedSnippet";

const LAYOUTS: { value: WidgetLayout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "compact", label: "Compact" },
];
const MODES: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "auto", label: "Auto" },
];

export function WidgetBuilder({ widgetId }: { widgetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<WidgetConfig | null>(null);
  const [baseline, setBaseline] = useState<string>("");

  const { data, isLoading, isError } = useQuery({
    queryKey: qk.widgets.detail(widgetId),
    queryFn: () => apiFetch<WidgetConfig>(endpoints.widgets.get(widgetId)),
  });

  useEffect(() => {
    if (data && !draft) {
      setDraft(data);
      setBaseline(JSON.stringify(data));
    }
  }, [data, draft]);

  const dirty = useMemo(
    () => (draft ? JSON.stringify(draft) !== baseline : false),
    [draft, baseline],
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useMutation({
    mutationFn: (cfg: WidgetConfig) =>
      apiFetch<WidgetConfig>(endpoints.widgets.update(widgetId), {
        method: "PATCH",
        body: {
          name: cfg.name,
          status: cfg.status,
          layout: cfg.layout,
          theme: cfg.theme,
          content: cfg.content,
          filters: cfg.filters,
          behavior: cfg.behavior,
        },
      }),
    onSuccess: () => {
      // Current draft is now the saved baseline → clears the dirty flag.
      setBaseline(JSON.stringify(draft));
      queryClient.invalidateQueries({ queryKey: qk.widgets.all });
      toast.success("Widget saved");
    },
    onError: () => toast.error("Couldn't save the widget"),
  });

  if (isLoading || !draft) {
    return <WidgetBuilderSkeleton />;
  }
  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Couldn&apos;t load this widget.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/widgets">Back to widgets</Link>
        </Button>
      </div>
    );
  }

  // Immutable nested updaters.
  const set = (patch: Partial<WidgetConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setTheme = (patch: Partial<WidgetConfig["theme"]>) =>
    setDraft((d) => (d ? { ...d, theme: { ...d.theme, ...patch } } : d));
  const setContent = (patch: Partial<WidgetConfig["content"]>) =>
    setDraft((d) => (d ? { ...d, content: { ...d.content, ...patch } } : d));
  const setFields = (patch: Partial<WidgetConfig["content"]["fields"]>) =>
    setDraft((d) =>
      d ? { ...d, content: { ...d.content, fields: { ...d.content.fields, ...patch } } } : d,
    );
  const setFilters = (patch: Partial<WidgetConfig["filters"]>) =>
    setDraft((d) => (d ? { ...d, filters: { ...d.filters, ...patch } } : d));
  const setBehavior = (patch: Partial<WidgetConfig["behavior"]>) =>
    setDraft((d) => (d ? { ...d, behavior: { ...d.behavior, ...patch } } : d));

  const toggleType = (value: string) => {
    const set_ = new Set(draft.filters.employment_types);
    if (set_.has(value)) set_.delete(value);
    else set_.add(value);
    setFilters({ employment_types: [...set_] });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href="/dashboard/widgets" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              className="w-full max-w-sm border-0 bg-transparent text-2xl font-semibold outline-none focus:ring-0"
              aria-label="Widget name"
            />
            <p className="text-sm text-muted-foreground">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.status === "active"}
              onCheckedChange={(c) => set({ status: c ? "active" : "disabled" })}
              id="status"
            />
            <Label htmlFor="status" className="text-sm">
              {draft.status === "active" ? "Active" : "Disabled"}
            </Label>
          </div>
          <Button onClick={() => save.mutate(draft)} disabled={!dirty || save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Control panel */}
        <div className="space-y-6">
          <Section title="Layout">
            <Segmented
              options={LAYOUTS}
              value={draft.layout}
              onChange={(v) => set({ layout: v as WidgetLayout })}
            />
          </Section>

          <Section title="Theme">
            <Field label="Mode">
              <Segmented
                options={MODES}
                value={draft.theme.mode}
                onChange={(v) => setTheme({ mode: v as ThemeMode })}
              />
            </Field>
            <Field label="Accent color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.theme.accent}
                  onChange={(e) => setTheme({ accent: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  aria-label="Accent color"
                />
                <Input
                  value={draft.theme.accent}
                  onChange={(e) => setTheme({ accent: e.target.value })}
                  className="w-32 font-mono text-sm"
                />
              </div>
            </Field>
            <Field label={`Corner radius — ${draft.theme.radius}px`}>
              <input
                type="range"
                min={0}
                max={32}
                value={draft.theme.radius}
                onChange={(e) => setTheme({ radius: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </Field>
          </Section>

          <Section title="Content">
            <ToggleRow
              label="Show header"
              checked={draft.content.show_header}
              onChange={(c) => setContent({ show_header: c })}
            />
            <Field label="Heading">
              <Input value={draft.content.heading} onChange={(e) => setContent({ heading: e.target.value })} />
            </Field>
            <Field label="Subtitle">
              <Input value={draft.content.subtitle} onChange={(e) => setContent({ subtitle: e.target.value })} />
            </Field>
            <Field label="Apply button label">
              <Input value={draft.content.cta_label} onChange={(e) => setContent({ cta_label: e.target.value })} />
            </Field>
            <ToggleRow
              label="Show 'view all' link"
              checked={draft.content.show_view_all}
              onChange={(c) => setContent({ show_view_all: c })}
            />
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Visible fields</p>
              <div className="grid grid-cols-2 gap-2">
                <ToggleRow label="Department" checked={draft.content.fields.department} onChange={(c) => setFields({ department: c })} />
                <ToggleRow label="Location" checked={draft.content.fields.location} onChange={(c) => setFields({ location: c })} />
                <ToggleRow label="Employment type" checked={draft.content.fields.employment_type} onChange={(c) => setFields({ employment_type: c })} />
                <ToggleRow label="Posted date" checked={draft.content.fields.posted_date} onChange={(c) => setFields({ posted_date: c })} />
              </div>
            </div>
          </Section>

          <Section title="Filtering">
            <Field label="Departments (comma-separated)">
              <Input
                value={draft.filters.departments.join(", ")}
                placeholder="Engineering, Design"
                onChange={(e) => setFilters({ departments: splitCsv(e.target.value) })}
              />
            </Field>
            <Field label="Locations (comma-separated)">
              <Input
                value={draft.filters.locations.join(", ")}
                placeholder="Remote, NYC"
                onChange={(e) => setFilters({ locations: splitCsv(e.target.value) })}
              />
            </Field>
            <Field label="Employment types">
              <div className="flex flex-wrap gap-2">
                {EMPLOYMENT_TYPES.map((t) => {
                  const on = draft.filters.employment_types.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleType(t.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Max roles (0 = unlimited)">
              <Input
                type="number"
                min={0}
                value={draft.filters.max_roles}
                onChange={(e) => setFilters({ max_roles: Math.max(0, Number(e.target.value) || 0) })}
                className="w-28"
              />
            </Field>
          </Section>

          <Section title="Behavior">
            <ToggleRow label="Enable search box" checked={draft.behavior.enable_search} onChange={(c) => setBehavior({ enable_search: c })} />
            <ToggleRow label="Open links in a new tab" checked={draft.behavior.open_in_new_tab} onChange={(c) => setBehavior({ open_in_new_tab: c })} />
          </Section>
        </div>

        {/* Preview + snippet (sticky) */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live preview
            </p>
            <WidgetPreview config={draft} />
          </div>
          <EmbedSnippet widgetId={widgetId} />
        </div>
      </div>
    </div>
  );
}

function splitCsv(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1.5 text-sm transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
