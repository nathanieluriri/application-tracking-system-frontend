import { WidgetsList, NewWidgetButton } from "@/components/widgets/WidgetsList";

export default function WidgetsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Widgets</h1>
          <p className="text-sm text-muted-foreground">
            Build embeddable job widgets and drop them on any website.
          </p>
        </div>
        <NewWidgetButton />
      </header>
      <WidgetsList />
    </div>
  );
}
