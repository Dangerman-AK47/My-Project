"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-refreshes data every `intervalMs` ms (default 30s).
 * - Pauses polling automatically while the browser tab is hidden.
 * - Immediately refreshes when the tab becomes visible if the interval has elapsed.
 * - Prevents overlapping refreshes.
 * - Uses `onRefresh` when provided, or falls back to `router.refresh()`.
 */
export function useAutoRefresh(
  intervalMs: number = 30000,
  onRefresh?: () => Promise<void> | void
) {
  const router = useRouter();
  const routerRef = useRef(router);
  const onRefreshRef = useRef(onRefresh);
  const inFlightRef = useRef(false);
  const lastRefreshAtRef = useRef<number>(Date.now());

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    async function executeRefresh() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      lastRefreshAtRef.current = Date.now();
      try {
        if (onRefreshRef.current) {
          await onRefreshRef.current();
        } else {
          routerRef.current.refresh();
        }
      } catch {
        // Ignore transient background refresh errors to avoid disrupting the UI
      } finally {
        inFlightRef.current = false;
      }
    }

    const id = setInterval(() => {
      void executeRefresh();
    }, intervalMs);

    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAtRef.current >= intervalMs
      ) {
        void executeRefresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);
}
