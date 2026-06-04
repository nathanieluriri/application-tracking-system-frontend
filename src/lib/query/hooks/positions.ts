"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { endpoints, type ListQuery } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import { getPositionId, type Position } from "@/types/position";

// ── Queries ──────────────────────────────────────────────────────────────

export function usePositions(
  query: ListQuery,
  options?: Omit<UseQueryOptions<Position[]>, "queryKey" | "queryFn">,
) {
  return useQuery<Position[]>({
    queryKey: qk.positions.list(query),
    queryFn: () => apiFetch<Position[]>(endpoints.positions.list(query)),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function usePosition(id: string | undefined) {
  return useQuery<Position>({
    queryKey: qk.positions.detail(id ?? ""),
    queryFn: () => apiFetch<Position>(endpoints.positions.get(id ?? "")),
    enabled: Boolean(id),
  });
}

// ── Mutation payloads ──────────────────────────────────────────────────────

export interface PositionWritePayload {
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string;
  description?: string | null;
  requirements?: string[];
  status?: string;
  process_template_id?: string | null;
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation<Position, Error, PositionWritePayload>({
    mutationFn: (body) =>
      apiFetch<Position>(endpoints.positions.create(), { method: "POST", body }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.positions.all });
    },
  });
}

export interface UpdatePositionInput {
  id: string;
  patch: Partial<PositionWritePayload>;
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation<Position, Error, UpdatePositionInput>({
    mutationFn: ({ id, patch }) =>
      apiFetch<Position>(endpoints.positions.update(id), {
        method: "PATCH",
        body: patch,
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.positions.all });
      const snapshots = qc.getQueriesData<Position[]>({ queryKey: qk.positions.all });
      for (const [key, data] of snapshots) {
        if (!Array.isArray(data)) continue;
        qc.setQueryData<Position[]>(key, (prev) =>
          (prev ?? []).map((p) => (getPositionId(p) === id ? { ...p, ...patch } : p)),
        );
      }
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: qk.positions.all });
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.positions.all });
      if (vars?.id) void qc.invalidateQueries({ queryKey: qk.positions.detail(vars.id) });
    },
  });
}

export function useClosePosition() {
  const qc = useQueryClient();
  return useMutation<Position, Error, string>({
    mutationFn: (id) =>
      apiFetch<Position>(endpoints.positions.close(id), { method: "POST" }),
    onSettled: (_data, _err, id) => {
      void qc.invalidateQueries({ queryKey: qk.positions.all });
      if (id) void qc.invalidateQueries({ queryKey: qk.positions.detail(id) });
    },
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) =>
      apiFetch(endpoints.positions.remove(id), { method: "DELETE" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.positions.all });
    },
  });
}
