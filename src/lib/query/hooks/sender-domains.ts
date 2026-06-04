"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { qk } from "@/lib/query/keys";
import type { SenderDomainCreateValues } from "@/lib/forms/schemas/sender-domain";
import type { SenderDomain } from "@/types/sender-domain";

export function useSenderDomains() {
  return useQuery<SenderDomain[]>({
    queryKey: qk.senderDomains.all,
    queryFn: () => apiFetch<SenderDomain[]>(endpoints.senderDomains.list()),
  });
}

export function useCreateSenderDomain() {
  const qc = useQueryClient();
  return useMutation<SenderDomain, Error, SenderDomainCreateValues>({
    mutationFn: (body) =>
      apiFetch<SenderDomain>(endpoints.senderDomains.create(), {
        method: "POST",
        body,
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.senderDomains.all });
    },
  });
}

export function useVerifySenderDomain() {
  const qc = useQueryClient();
  return useMutation<SenderDomain, Error, string>({
    mutationFn: (id) =>
      apiFetch<SenderDomain>(endpoints.senderDomains.verify(id), {
        method: "POST",
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.senderDomains.all });
    },
  });
}

/** Re-fetch a single domain's status from Resend (used for polling). */
export function useRefreshSenderDomain() {
  const qc = useQueryClient();
  return useMutation<SenderDomain, Error, string>({
    mutationFn: (id) => apiFetch<SenderDomain>(endpoints.senderDomains.get(id)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.senderDomains.all });
    },
  });
}

export function useDeleteSenderDomain() {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, string>({
    mutationFn: (id) =>
      apiFetch<{ deleted: boolean }>(endpoints.senderDomains.remove(id), {
        method: "DELETE",
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.senderDomains.all });
    },
  });
}
