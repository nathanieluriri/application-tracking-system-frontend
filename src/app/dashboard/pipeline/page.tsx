import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag applicants between stages.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Kanban board</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stage columns will render here. Implement with @dnd-kit in Phase 6.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
