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
    <header className="glass-bar sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-2.5">
      {/* The same pill + pulse-dot the landing badge uses — the status chip is
          the thread that carries the hero's language into the console. */}
      <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1.5 text-xs text-muted-foreground">
        <span
          className={live ? "pulse-dot h-1.5 w-1.5 rounded-full" : "h-1.5 w-1.5 rounded-full"}
          style={{ backgroundColor: live ? "var(--approved)" : "var(--muted-foreground)" }}
          aria-hidden
        />
        <span className={live ? "text-foreground/85" : undefined}>
          {live ? "Stream live" : "Stream idle"}
        </span>
        <span className="hidden text-foreground/20 sm:inline">/</span>
        <span className="hidden sm:inline">Scoring on model v1</span>
      </div>

      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
        <Button
          size="sm"
          onClick={injectBurst}
          disabled={bursting}
          className="gap-1.5 bg-foreground text-background shadow-[0_6px_24px_-6px_rgba(76,141,246,0.5)] hover:bg-foreground/90"
        >
          <Zap className="h-3.5 w-3.5" />
          {bursting ? "Injecting…" : "Inject fraud burst"}
        </Button>
      </motion.div>
    </header>
  );
}
