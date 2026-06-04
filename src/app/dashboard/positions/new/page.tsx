import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PositionForm } from "@/components/positions/PositionForm";

export default function NewPositionPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/positions">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back to positions
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">New position</h1>
        <p className="text-sm text-muted-foreground">
          Define the role details and requirements.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionForm />
        </CardContent>
      </Card>
    </div>
  );
}
