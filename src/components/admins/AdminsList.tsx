"use client";

import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/feedback/LoadingOverlay";
import { useAdmins } from "@/lib/query/hooks/admins";
import { getAdminId, type Admin, type AdminAccountStatus } from "@/types/admin";

function statusVariant(
  status: AdminAccountStatus,
): "default" | "secondary" | "destructive" {
  if (status === "ACTIVE") return "default";
  if (status === "SUSPENDED") return "destructive";
  return "secondary";
}

interface AdminsListProps {
  initialData?: Admin[];
}

export function AdminsList({ initialData }: AdminsListProps) {
  const query = useAdmins({}, initialData ? { initialData } : undefined);
  const admins = query.data ?? [];

  return (
    <div className="relative rounded-lg border bg-card">
      <LoadingOverlay
        visible={query.isFetching && !query.isLoading}
        message="Loading…"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.length === 0 && !query.isLoading ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                No admins yet.
              </TableCell>
            </TableRow>
          ) : null}

          {admins.map((a) => (
            <TableRow key={getAdminId(a) || a.email}>
              <TableCell className="text-sm font-medium text-foreground">
                {a.full_name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {a.email}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(a.accountStatus)}>
                  {a.accountStatus}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {a.date_created
                  ? format(new Date(a.date_created * 1000), "MMM d, yyyy")
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
