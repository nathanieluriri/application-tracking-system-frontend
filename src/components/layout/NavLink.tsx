"use client";

import Link from "next/link";
import { type ComponentProps } from "react";
import { useNavigationProgress } from "@/providers/NavigationProgress";

type NavLinkProps = ComponentProps<typeof Link>;

/**
 * Drop-in for next/link that starts the top navigation progress bar on
 * client-side navigation, via the native `onNavigate` prop. Must be rendered
 * within a NavigationProgressProvider.
 */
export function NavLink({ onNavigate, ...props }: NavLinkProps) {
  const { start } = useNavigationProgress();
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        start();
        onNavigate?.(event);
      }}
    />
  );
}
