"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AutonomyMode } from "./types";

const MODE_STORAGE_KEY = "agent.mode";
const VALID_MODES: AutonomyMode[] = ["confirm_everything", "smart", "auto_run"];

type AgentTab = "chat" | "history";

interface AgentPanelContextValue {
  open: boolean;
  setOpen: (b: boolean) => void;
  toggle: () => void;
  mode: AutonomyMode;
  setMode: (m: AutonomyMode) => void;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  tab: AgentTab;
  setTab: (t: AgentTab) => void;
  newChat: () => void;
}

const AgentPanelContext = createContext<AgentPanelContextValue | null>(null);

export function useAgentPanel(): AgentPanelContextValue {
  const ctx = useContext(AgentPanelContext);
  if (!ctx) {
    throw new Error("useAgentPanel must be used within AgentPanelProvider");
  }
  return ctx;
}

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setModeState] = useState<AutonomyMode>("smart");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tab, setTab] = useState<AgentTab>("chat");

  // Read the persisted mode on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored && (VALID_MODES as string[]).includes(stored)) {
        setModeState(stored as AutonomyMode);
      }
    } catch {
      // localStorage may be unavailable (private mode, SSR edge) — ignore.
    }
  }, []);

  const setMode = useCallback((m: AutonomyMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      // ignore persistence failures.
    }
  }, []);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const newChat = useCallback(() => {
    setConversationId(null);
    setTab("chat");
  }, []);

  const value = useMemo<AgentPanelContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      mode,
      setMode,
      conversationId,
      setConversationId,
      tab,
      setTab,
      newChat,
    }),
    [open, toggle, mode, setMode, conversationId, tab, newChat],
  );

  return (
    <AgentPanelContext.Provider value={value}>
      {children}
    </AgentPanelContext.Provider>
  );
}
