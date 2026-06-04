import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Button asChild>
          <Link href="/dashboard/overview">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
