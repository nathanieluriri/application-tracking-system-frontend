"use client";

import { useEffect, useRef, useState } from "react";

interface DelayedFlagOptions {
  /** Wait this long while active before turning on (anti-flash). Default 200ms. */
  delay?: number;
  /** Once on, stay on at least this long (anti-flicker). Default 400ms. */
  minDuration?: number;
}

/**
 * Returns a boolean that turns on only after `active` has been true for `delay`,
 * and once on stays on for at least `minDuration`. Prevents a loader flashing for
 * sub-perceptible waits, and prevents flash-and-vanish flicker on borderline ones.
 */
export function useDelayedFlag(
  active: boolean,
  { delay = 200, minDuration = 400 }: DelayedFlagOptions = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      if (!visibleRef.current) {
        delayTimer = setTimeout(() => {
          visibleRef.current = true;
          shownAtRef.current = Date.now();
          setVisible(true);
        }, delay);
      }
    } else if (visibleRef.current) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, minDuration - elapsed);
      hideTimer = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
      }, remaining);
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [active, delay, minDuration]);

  return visible;
}
