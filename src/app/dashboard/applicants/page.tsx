import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApplicantsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Applicants</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and progress applicants through the pipeline.
          </p>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>List</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Applicants table will render here. Implement in Phase 5 vertical slice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
