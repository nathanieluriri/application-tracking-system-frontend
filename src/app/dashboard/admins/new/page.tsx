import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminForm } from "@/components/admins/AdminForm";

export default function NewAdminPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admins">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back to admins
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">New admin</h1>
        <p className="text-sm text-muted-foreground">
          Create another administrator account with full dashboard access.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminForm />
        </CardContent>
      </Card>
    </div>
  );
}
