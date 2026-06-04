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
import type { Applicant, ApplicationStatus } from "@/types/applicant";

export function useApplicants(
  query: ListQuery,
  options?: Omit<
    UseQueryOptions<Applicant[]>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<Applicant[]>({
    queryKey: qk.applicants.list(query),
    queryFn: () => apiFetch<Applicant[]>(endpoints.applications.list(query)),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useApplicant(id: string | undefined) {
  return useQuery<Applicant>({
    queryKey: qk.applicants.detail(id ?? ""),
    queryFn: () => apiFetch<Applicant>(endpoints.applications.get(id ?? "")),
    enabled: Boolean(id),
  });
}

export interface UpdateApplicantInput {
  id: string;
  patch: Partial<{
    status: ApplicationStatus | string;
    rating: number;
    notes: string;
    cv_document_id: string | null;
  }>;
}

export function useUpdateApplicant() {
  const qc = useQueryClient();
  return useMutation<Applicant, Error, UpdateApplicantInput, { previous?: Applicant[] }>({
    mutationFn: ({ id, patch }) =>
      apiFetch<Applicant>(endpoints.applications.update(id), {
        method: "PATCH",
        body: patch,
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.applicants.all });
      const snapshots = qc.getQueriesData<Applicant[]>({
        queryKey: qk.applicants.all,
      });
      for (const [key, data] of snapshots) {
        if (!Array.isArray(data)) continue;
        qc.setQueryData<Applicant[]>(key, (prev) =>
          (prev ?? []).map((a) =>
            (a.id ?? a._id) === id ? { ...a, ...patch } : a,
          ),
        );
      }
      return { previous: undefined };
    },
    onError: () => {
      // The simplest safe rollback is a refetch — no need to thread snapshots.
      void qc.invalidateQueries({ queryKey: qk.applicants.all });
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: qk.applicants.all });
      if (vars?.id) {
        void qc.invalidateQueries({
          queryKey: qk.applicants.detail(vars.id),
        });
      }
    },
  });
}

export interface BulkStatusInput {
  ids: string[];
  status: ApplicationStatus | string;
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient();
  return useMutation<{ modified: number }, Error, BulkStatusInput>({
    mutationFn: (body) =>
      apiFetch<{ modified: number }>(endpoints.applications.bulkStatus(), {
        method: "POST",
        body,
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.applicants.all });
    },
  });
}

export function useDeleteApplicant() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) =>
      apiFetch(endpoints.applications.remove(id), { method: "DELETE" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.applicants.all });
    },
  });
}
