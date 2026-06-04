"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavigationProgressContextValue {
  start: () => void;
  done: () => void;
}

const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);

export function useNavigationProgress(): NavigationProgressContextValue {
  const ctx = useContext(NavigationProgressContext);
  if (!ctx) {
    throw new Error(
      "useNavigationProgress must be used within NavigationProgressProvider",
    );
  }
  return ctx;
}

const SAFETY_TIMEOUT_MS = 10_000;
const TRICKLE_INTERVAL_MS = 400;
const FADE_OUT_MS = 250;

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  // null = hidden; otherwise a number 0..100.
  const [progress, setProgress] = useState<number | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const clearTimers = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const done = useCallback(() => {
    clearTimers();
    setProgress((p) => (p === null ? null : 100));
    if (fadeRef.current) clearTimeout(fadeRef.current);
    fadeRef.current = setTimeout(() => setProgress(null), FADE_OUT_MS);
  }, [clearTimers]);

  const start = useCallback(() => {
    if (fadeRef.current) {
      clearTimeout(fadeRef.current);
      fadeRef.current = null;
    }
    clearTimers();
    setProgress(8);
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p === null) return null;
        if (p >= 90) return p; // creep — never reach 100 until done()
        return p + Math.max(1, (90 - p) * 0.1);
      });
    }, TRICKLE_INTERVAL_MS);
    // Safety net: never leave the bar stuck if a navigation aborts.
    safetyRef.current = setTimeout(() => done(), SAFETY_TIMEOUT_MS);
  }, [clearTimers, done]);

  // Complete when the route actually changes (also runs on mount — harmless,
  // since progress is null there and done() is a no-op).
  useEffect(() => {
    done();
  }, [pathname, done]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      clearTimers();
      if (fadeRef.current) clearTimeout(fadeRef.current);
    },
    [clearTimers],
  );

  const visible = progress !== null;

  return (
    <NavigationProgressContext.Provider value={{ start, done }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      >
        <div
          className={cn(
            "h-full bg-primary transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none",
            visible ? "opacity-100" : "opacity-0",
          )}
          style={{ width: `${progress ?? 0}%` }}
        />
      </div>
      {children}
    </NavigationProgressContext.Provider>
  );
}
