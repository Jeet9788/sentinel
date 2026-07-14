"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BACKOFF_MS = 60_000;

/**
 * Polls an endpoint on an interval, backing off when it fails.
 *
 * A dashboard that hammers a failing endpoint every four seconds turns a small
 * outage into a large one, so each failure doubles the wait until it recovers.
 * `stale` is what the "reconnecting" indicator reads: the last good data is kept
 * on screen rather than blanked, because stale numbers are more useful to an
 * analyst than no numbers, as long as they are labeled as stale.
 */
export function usePoll<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T>();
  const [stale, setStale] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let backoff = intervalMs;

    const run = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as T;
        if (cancelled) return;
        setData(json);
        setStale(false);
        backoff = intervalMs;
      } catch {
        if (cancelled) return;
        setStale(true);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
      if (!cancelled) timer.current = setTimeout(run, backoff);
    };

    run();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [url, intervalMs]);

  return { data, stale };
}
