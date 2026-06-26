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
import type { Admin } from "@/types/admin";

// ── Queries ──────────────────────────────────────────────────────────────

export function useAdmins(
  query: ListQuery = {},
  options?: Omit<UseQueryOptions<Admin[]>, "queryKey" | "queryFn">,
) {
  return useQuery<Admin[]>({
    queryKey: qk.admins.list(query),
    queryFn: () => apiFetch<Admin[]>(endpoints.admins.list(query)),
    placeholderData: (prev) => prev,
    ...options,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export interface CreateAdminPayload {
  full_name: string;
  email: string;
  password: string;
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation<Admin, Error, CreateAdminPayload>({
    mutationFn: (body) =>
      apiFetch<Admin>(endpoints.admins.create(), { method: "POST", body }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.admins.all });
    },
  });
}
