"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { chat } from "@/lib/agent/client";
import { useConversation, useSetFeedback } from "@/lib/agent/hooks";
import { useAgentPanel } from "@/lib/agent/store";
import { qk } from "@/lib/query/keys";
import type {
  ChatResponse,
  ConversationMessage,
  PendingConfirmation,
} from "@/lib/agent/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/feedback/Spinner";
import { MessageBubble } from "./MessageBubble";
import { StepProgress } from "./StepProgress";
import { SuggestionChips } from "./SuggestionChips";
import { ConfirmCard } from "./ConfirmCard";
import { Composer } from "./Composer";

const STARTER_SUGGESTIONS = [
  "List open positions",
  "Create a job posting",
  "Show recent applicants",
  "Summarize this week's activity",
];

interface SendVariables {
  message?: string;
  confirmToken?: string;
}

export function ChatThread() {
  const { conversationId, setConversationId, mode } = useAgentPanel();
  const queryClient = useQueryClient();

  const conversationQuery = useConversation(conversationId);
  const setFeedbackMutation = useSetFeedback();

  // The latest assistant turn's animated steps + pending confirmation.
  const [activeSteps, setActiveSteps] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const messages: ConversationMessage[] = useMemo(
    () => conversationQuery.data?.messages ?? [],
    [conversationQuery.data],
  );

  const sendMutation = useMutation<ChatResponse, Error, SendVariables>({
    mutationFn: (vars) =>
      chat({
        message: vars.message,
        confirmToken: vars.confirmToken,
        conversationId: conversationId ?? undefined,
        mode,
      }),
    onMutate: (vars) => {
      // Reset any prior confirmation while a new turn is in flight.
      setPending(null);
      if (vars.message) {
        setActiveSteps([]);
      }
    },
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setActiveSteps(res.steps.map((s) => s.label));
      setPending(res.pending ?? null);
    },
    onError: () => {
      toast.error("Couldn't reach the assistant — try again.");
    },
    onSettled: (res) => {
      queryClient.invalidateQueries({ queryKey: qk.agent.conversations });
      const id = res?.conversationId ?? conversationId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: qk.agent.conversation(id) });
      }
    },
  });

  const sending = sendMutation.isPending;

  function send(text: string) {
    sendMutation.mutate({ message: text });
  }

  function confirm() {
    if (!pending) return;
    sendMutation.mutate({ confirmToken: pending.token });
  }

  function cancelPending() {
    setPending(null);
  }

  function handleFeedback(messageId: string, fb: "up" | "down") {
    if (!conversationId) return;
    const current = messages.find((m) => m.id === messageId)?.feedback ?? null;
    setFeedbackMutation.mutate({
      id: conversationId,
      messageId,
      // Toggle off when clicking the already-active feedback.
      feedback: current === fb ? null : fb,
    });
  }

  // Auto-scroll to the latest content when messages change or a turn lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, pending]);

  const isEmpty = messages.length === 0 && !sending;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col gap-4 p-4">
          {isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
              <Sparkles className="h-8 w-8 text-primary" />
              <p className="text-base font-medium text-foreground">
                Hello 👋 How can I help you today?
              </p>
              <SuggestionChips
                suggestions={STARTER_SUGGESTIONS}
                onPick={send}
              />
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onPick={send}
                  onFeedback={handleFeedback}
                />
              ))}

              {sending && (
                <div className="flex flex-col gap-2">
                  {activeSteps.length > 0 ? (
                    <StepProgress steps={activeSteps} active />
                  ) : (
                    <Spinner size="sm" label="Thinking…" className="text-primary" />
                  )}
                </div>
              )}

              {!sending && pending && (
                <ConfirmCard
                  preview={pending.preview}
                  pending={false}
                  onConfirm={confirm}
                  onCancel={cancelPending}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <Composer onSend={send} sending={sending} />
    </div>
  );
}
