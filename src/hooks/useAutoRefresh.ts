"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-refreshes the current route's server data every `intervalMs` ms.
 * Uses router.refresh() which re-fetches server components without losing client state.
 */
export function useAutoRefresh(intervalMs: number = 30000) {
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => {
      routerRef.current.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
