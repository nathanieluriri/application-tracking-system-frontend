"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useNavigationProgress } from "@/providers/NavigationProgress";

/**
 * Wraps router.push/replace so programmatic navigation (e.g. after a mutation)
 * also drives the top progress bar. Use inside the dashboard subtree, where
 * NavigationProgressProvider is mounted.
 */
export function useNavigate() {
  const router = useRouter();
  const { start } = useNavigationProgress();

  const push = useCallback(
    (href: string) => {
      start();
      router.push(href);
    },
    [router, start],
  );

  const replace = useCallback(
    (href: string) => {
      start();
      router.replace(href);
    },
    [router, start],
  );

  return { push, replace, router };
}
