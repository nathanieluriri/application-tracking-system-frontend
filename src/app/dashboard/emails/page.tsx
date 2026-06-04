import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmailsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Track delivery and compose new messages.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/emails/compose">Compose</Link>
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Sent log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            List rendering deferred to vertical-slice phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
