import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ComposeEmailPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Compose email</h1>
        <p className="text-sm text-muted-foreground">
          Pick a template or write a custom message.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Recipients & message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ComposeForm will render here in the vertical-slice phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
