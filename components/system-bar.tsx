"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const TICK_INTERVAL_MS = 20_000;

/**
 * Keeps the simulated payment stream moving while someone is watching.
 *
 * Vercel's Hobby plan runs crons once a day, so a cron cannot drive a live feed.
 * Rather than fake it, the stream is driven by presence: the dashboard asks the
 * server to advance it, and the server throttles so that ten open tabs still
 * produce one batch per interval. Traffic exists when someone is there to see it.
 */
export function SystemBar() {
  const [live, setLive] = useState(false);
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const advance = async () => {
      try {
        const response = await fetch("/api/simulate/tick", { method: "POST" });
        if (!cancelled) setLive(response.ok);
      } catch {
        if (!cancelled) setLive(false);
      }
    };

    advance();
    const timer = setInterval(advance, TICK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const injectBurst = useCallback(async () => {
    setBursting(true);
    try {
      const response = await fetch("/api/simulate/burst", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      const { ingested } = (await response.json()) as { ingested: number };
      toast.success(`${ingested} transactions injected`, {
        description: "Includes known fraud. Watch the feed and the review queue.",
      });
    } catch {
      toast.error("Could not inject transactions", {
        description: "The simulator did not respond. Try again.",
      });
    } finally {
      setBursting(false);
    }
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={live ? "pulse-dot h-2 w-2 rounded-full" : "h-2 w-2 rounded-full"}
          style={{ backgroundColor: live ? "var(--approved)" : "var(--muted-foreground)" }}
          aria-hidden
        />
        <span>{live ? "Stream live" : "Stream idle"}</span>
        <span className="hidden text-border sm:inline">/</span>
        <span className="hidden sm:inline">Scoring on model v1</span>
      </div>

      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
        <Button
          size="sm"
          onClick={injectBurst}
          disabled={bursting}
          className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <Zap className="h-3.5 w-3.5" />
          {bursting ? "Injecting…" : "Inject fraud burst"}
        </Button>
      </motion.div>
    </header>
  );
}
