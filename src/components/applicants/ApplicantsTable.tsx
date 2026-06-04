"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { StatusBadge } from "@/components/applicants/StatusBadge";
import { BulkActionsBar } from "@/components/applicants/BulkActionsBar";
import {
  ApplicantFilters,
  APPLICANT_PAGE_SIZE,
  useApplicantFilters,
} from "@/components/applicants/ApplicantFilters";
import {
  useApplicants,
  useUpdateApplicant,
  useDeleteApplicant,
} from "@/lib/query/hooks/applicants";
import {
  STATUS_ORDER,
  getApplicantId,
  statusConfig,
  type Applicant,
  type ApplicationStatus,
} from "@/types/applicant";

interface ApplicantsTableProps {
  initialData?: Applicant[];
  positions: Array<{ id: string; label: string }>;
}

export function ApplicantsTable({ initialData, positions }: ApplicantsTableProps) {
  const [filters] = useApplicantFilters();
  const page = Math.max(1, filters.page);
  const start = (page - 1) * APPLICANT_PAGE_SIZE;
  const stop = start + APPLICANT_PAGE_SIZE;

  const query = useApplicants(
    {
      start,
      stop,
      search: filters.search || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      position_id: filters.position_id === "all" ? undefined : filters.position_id,
    },
    initialData ? { initialData } : undefined,
  );

  const applicants = query.data ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Applicant | null>(null);

  const update = useUpdateApplicant();
  const del = useDeleteApplicant();

  const selectableIds = useMemo(
    () => applicants.map(getApplicantId).filter(Boolean),
    [applicants],
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected =
    selectableIds.some((id) => selected.has(id)) && !allSelected;

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const id of selectableIds) next.add(id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function changeStatus(id: string, status: ApplicationStatus) {
    try {
      await update.mutateAsync({ id, patch: { status } });
      toast.success(`Moved to ${statusConfig(status).label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await del.mutateAsync(getApplicantId(pendingDelete));
      toast.success(`Deleted ${pendingDelete.full_name}`);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(getApplicantId(pendingDelete));
        return next;
      });
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <ApplicantFilters positions={positions} />

      <BulkActionsBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />

      <div className="relative rounded-lg border bg-card">
        <LoadingOverlay
          visible={(query.isFetching && !query.isLoading) || update.isPending}
          message="Updating…"
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all on this page"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Applied</TableHead>
              <TableHead className="hidden lg:table-cell">Rating</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicants.length === 0 && !query.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No applicants match those filters.
                </TableCell>
              </TableRow>
            ) : null}

            {applicants.map((a) => {
              const id = getApplicantId(a);
              const isChecked = selected.has(id);
              return (
                <TableRow
                  key={id || a.email}
                  data-state={isChecked ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(id)}
                      aria-label={`Select ${a.full_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/dashboard/applicants/${id}`}
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        {a.full_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{a.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {a.position_title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {a.applied_date
                      ? format(new Date(a.applied_date * 1000), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {a.rating ? "★".repeat(a.rating) : "—"}
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
                          <Link href={`/dashboard/applicants/${id}`}>View detail</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/applicants/${id}/edit`}>Edit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/emails/compose?to=${id}`}
                          >
                            Email applicant
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                          Move to
                        </DropdownMenuLabel>
                        {STATUS_ORDER.filter((s) => s !== a.status).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onSelect={() => void changeStatus(id, s)}
                          >
                            {statusConfig(s).label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setPendingDelete(a)}
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

      <ApplicantsPagination
        page={page}
        hasMore={applicants.length >= APPLICANT_PAGE_SIZE}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete applicant?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This permanently removes ${pendingDelete.full_name} and their history. This cannot be undone.`
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

function ApplicantsPagination({
  page,
  hasMore,
}: {
  page: number;
  hasMore: boolean;
}) {
  const [, setFilters] = useApplicantFilters();
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
