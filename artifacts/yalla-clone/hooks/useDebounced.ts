import { useEffect, useState } from "react";

/**
 * Delay a fast-changing value so it does not drive a request per keystroke.
 *
 * Search typing at speed would otherwise fire a query for every character —
 * most of them already stale by the time they land, and each one counted
 * against the server's per-account rate limit.
 */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
