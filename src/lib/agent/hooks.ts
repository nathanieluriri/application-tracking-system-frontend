"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  setFeedback,
} from "./client";

export function useConversations() {
  return useQuery({
    queryKey: qk.agent.conversations,
    queryFn: () => listConversations(),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: qk.agent.conversation(id ?? "none"),
    queryFn: () => getConversation(id!),
    enabled: !!id,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.agent.conversations });
    },
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameConversation(id, title),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.agent.conversations });
      queryClient.invalidateQueries({
        queryKey: qk.agent.conversation(variables.id),
      });
    },
  });
}

export function useSetFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      messageId,
      feedback,
    }: {
      id: string;
      messageId: string;
      feedback: "up" | "down" | null;
    }) => setFeedback(id, messageId, feedback),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: qk.agent.conversation(variables.id),
      });
    },
  });
}
