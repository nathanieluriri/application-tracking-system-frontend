"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  return (
    <Link
      {...props}
      onNavigate={(event) => {
        // A same-route click won't change the pathname, so the provider's
        // completion effect would never fire — don't start the bar, or it would
        // hang until the safety timeout.
        const isSameRoute =
          typeof props.href === "string" && props.href === pathname;
        if (!isSameRoute) start();
        onNavigate?.(event);
      }}
    />
  );
}
