"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Copy, MoreHorizontal, Loader2, LayoutGrid } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import { generateSnippet } from "@/lib/widget/snippet";
import { defaultWidgetConfig, type WidgetConfig } from "@/lib/widget/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type WidgetItem = WidgetConfig & { id: string; date_created?: number };

export function WidgetsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<WidgetItem | null>(null);

  const { data: widgets, isLoading } = useQuery({
    queryKey: qk.widgets.all,
    queryFn: () => apiFetch<WidgetItem[]>(endpoints.widgets.list()),
  });

  const createWidget = useMutation({
    mutationFn: () =>
      apiFetch<WidgetItem>(endpoints.widgets.create(), {
        method: "POST",
        body: defaultWidgetConfig("Untitled widget"),
      }),
    onSuccess: (w) => {
      queryClient.invalidateQueries({ queryKey: qk.widgets.all });
      router.push(`/dashboard/widgets/${w.id}/edit`);
    },
    onError: () => toast.error("Couldn't create the widget"),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<WidgetItem>(endpoints.widgets.duplicate(id), { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.widgets.all });
      toast.success("Widget duplicated");
    },
    onError: () => toast.error("Couldn't duplicate the widget"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(endpoints.widgets.remove(id), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.widgets.all });
      toast.success("Widget deleted");
      setToDelete(null);
    },
    onError: () => toast.error("Couldn't delete the widget"),
  });

  async function copyEmbed(id: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      await navigator.clipboard.writeText(generateSnippet({ origin, widgetId: id }));
      toast.success("Embed snippet copied");
    } catch {
      toast.error("Couldn't copy — try the Edit page");
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!widgets || widgets.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LayoutGrid className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No widgets yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Create an embeddable widget to show your open roles on any website.
        </p>
        <Button className="mt-6" onClick={() => createWidget.mutate()} disabled={createWidget.isPending}>
          {createWidget.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New widget
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((w) => (
          <div key={w.id} className="group flex flex-col rounded-lg border p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/dashboard/widgets/${w.id}/edit`} className="min-w-0">
                <h3 className="truncate font-medium hover:underline">{w.name}</h3>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/widgets/${w.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicate.mutate(w.id)}>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setToDelete(w)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">{w.layout}</Badge>
              <Badge variant={w.status === "active" ? "default" : "outline"} className="capitalize">
                {w.status}
              </Badge>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t pt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyEmbed(w.id)}>
                <Copy className="h-3.5 w-3.5" /> Copy embed
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/widgets/${w.id}/edit`}>Edit</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the widget. Any site embedding it will show an empty state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function NewWidgetButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createWidget = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(endpoints.widgets.create(), {
        method: "POST",
        body: defaultWidgetConfig("Untitled widget"),
      }),
    onSuccess: (w) => {
      queryClient.invalidateQueries({ queryKey: qk.widgets.all });
      router.push(`/dashboard/widgets/${w.id}/edit`);
    },
    onError: () => toast.error("Couldn't create the widget"),
  });
  return (
    <Button onClick={() => createWidget.mutate()} disabled={createWidget.isPending}>
      {createWidget.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      New widget
    </Button>
  );
}
