"use client";

import { useState } from "react";
import { toast } from "sonner";

import { BandMeter } from "@/components/band-meter";
import { DecisionBadge } from "@/components/decision-badge";
import { FactorList } from "@/components/queue/factor-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney, fmtScore } from "@/lib/format";
import type { CaseView } from "@/lib/views";

type Props = {
  openCase: CaseView | null;
  tLow: number;
  tHigh: number;
  onOpenChange: (open: boolean) => void;
  onResolved: (id: string) => void;
};

export function CaseDrawer({ openCase, tLow, tHigh, onOpenChange, onResolved }: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resolve = async (resolution: "analyst_approved" | "analyst_blocked") => {
    if (!openCase) return;
    setSubmitting(true);

    // Optimistic: the analyst's next case should be in front of them immediately,
    // not after a round trip. If the write fails, the case comes back.
    onResolved(openCase.id);
    onOpenChange(false);

    try {
      const response = await fetch(`/api/cases/${openCase.id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution, note: note.trim() || undefined }),
      });
      if (!response.ok) throw new Error(String(response.status));

      toast.success(
        resolution === "analyst_blocked" ? "Transaction blocked" : "Transaction approved",
        { description: `${openCase.transaction.merchant} · ${fmtMoney(openCase.transaction.amountCents)}` },
      );
      setNote("");
    } catch {
      toast.error("Could not record your decision", {
        description: "The case is still open. Try again.",
      });
      onResolved("");
    } finally {
      setSubmitting(false);
    }
  };

  const txn = openCase?.transaction;

  return (
    <Sheet open={Boolean(openCase)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        {txn && openCase && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>
                {txn.merchant}
              </SheetTitle>
              <SheetDescription>
                {fmtMoney(txn.amountCents)} · •••• {txn.cardLast4} · {txn.city}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-4">
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Fraud score
                    </p>
                    <p
                      className="text-4xl font-semibold tabular"
                      style={{ fontFamily: "var(--font-heading)", color: "var(--review)" }}
                    >
                      {fmtScore(txn.score)}
                    </p>
                  </div>
                  <DecisionBadge decision={txn.decision} scoringError={txn.scoringError} />
                </div>
                <BandMeter score={txn.score} tLow={tLow} tHigh={tHigh} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Too risky to approve, not certain enough to block. That gap is what you are for.
                </p>
              </section>

              <section>
                <h3 className="mb-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Why it was flagged
                </h3>
                <FactorList factors={txn.topFactors} />
                <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Impact is how far the score would have fallen had that feature been unremarkable.
                  V-features are the dataset&apos;s anonymized PCA components.
                </p>
              </section>

              <section>
                <label
                  htmlFor="case-note"
                  className="mb-2 block text-[11px] uppercase tracking-wider text-muted-foreground"
                >
                  Note (optional)
                </label>
                <Textarea
                  id="case-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What did you check?"
                  rows={3}
                />
              </section>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border p-4">
              <Button
                variant="outline"
                disabled={submitting}
                onClick={() => resolve("analyst_approved")}
                style={{ borderColor: "var(--approved)", color: "var(--approved)" }}
              >
                Approve
              </Button>
              <Button
                disabled={submitting}
                onClick={() => resolve("analyst_blocked")}
                style={{ backgroundColor: "var(--blocked)", color: "#fff" }}
              >
                Block
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
