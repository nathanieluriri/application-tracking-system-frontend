"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingOverlay } from "@/components/feedback/LoadingOverlay";
import { PositionStatusBadge } from "@/components/positions/PositionStatusBadge";
import {
  PositionFilters,
  POSITION_PAGE_SIZE,
  usePositionFilters,
} from "@/components/positions/PositionFilters";
import {
  usePositions,
  useClosePosition,
  useDeletePosition,
} from "@/lib/query/hooks/positions";
import { getPositionId, employmentTypeLabel, type Position } from "@/types/position";

interface PositionsTableProps {
  initialData?: Position[];
  departments: string[];
}

export function PositionsTable({ initialData, departments }: PositionsTableProps) {
  const [filters] = usePositionFilters();
  const page = Math.max(1, filters.page);
  const start = (page - 1) * POSITION_PAGE_SIZE;
  const stop = start + POSITION_PAGE_SIZE;

  const query = usePositions(
    {
      start,
      stop,
      status: filters.status === "all" ? undefined : filters.status,
      department: filters.department === "all" ? undefined : filters.department,
    },
    initialData ? { initialData } : undefined,
  );

  const positions = query.data ?? [];
  const [pendingClose, setPendingClose] = useState<Position | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Position | null>(null);

  const closePos = useClosePosition();
  const del = useDeletePosition();

  async function confirmClose() {
    if (!pendingClose) return;
    try {
      await closePos.mutateAsync(getPositionId(pendingClose));
      toast.success(`"${pendingClose.title}" closed`);
      setPendingClose(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Close failed");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await del.mutateAsync(getPositionId(pendingDelete));
      toast.success(`Deleted "${pendingDelete.title}"`);
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <PositionFilters departments={departments} />

      <div className="relative rounded-lg border bg-card">
        <LoadingOverlay
          visible={query.isFetching && !query.isLoading}
          message="Loading…"
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden lg:table-cell">Location</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.length === 0 && !query.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No positions match those filters.
                </TableCell>
              </TableRow>
            ) : null}

            {positions.map((p) => {
              const id = getPositionId(p);
              return (
                <TableRow key={id || p.title}>
                  <TableCell>
                    <Link
                      href={`/dashboard/positions/${id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {p.department ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {p.location ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {employmentTypeLabel(p.employment_type)}
                  </TableCell>
                  <TableCell>
                    <PositionStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {p.date_created
                      ? format(new Date(p.date_created * 1000), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Open actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/positions/${id}`}>View detail</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/positions/${id}/edit`}>Edit</Link>
                        </DropdownMenuItem>
                        {p.status !== "closed" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setPendingClose(p)}>
                              Close position
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setPendingDelete(p)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PositionsPagination
        page={page}
        hasMore={positions.length >= POSITION_PAGE_SIZE}
      />

      {/* Close confirm */}
      <AlertDialog
        open={pendingClose !== null}
        onOpenChange={(open) => !open && setPendingClose(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close position?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingClose
                ? `This marks "${pendingClose.title}" as closed and stops new public applications. You can reopen it later by editing its status.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closePos.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={closePos.isPending}
              onClick={(e) => {
                e.preventDefault();
                void confirmClose();
              }}
            >
              {closePos.isPending ? "Closing…" : "Close position"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete position?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This permanently removes "${pendingDelete.title}". This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PositionsPagination({ page, hasMore }: { page: number; hasMore: boolean }) {
  const [, setFilters] = usePositionFilters();
  if (page <= 1 && !hasMore) return null;
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">Page {page}</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => void setFilters({ page: Math.max(1, page - 1) })}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => void setFilters({ page: page + 1 })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
