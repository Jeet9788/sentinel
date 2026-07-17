"use client";

import { useRouter } from "next/navigation";

import { LiquidMetalHero } from "@/components/liquid-metal-hero";

export default function LandingPage() {
  const router = useRouter();

  return (
    <LiquidMetalHero
      badge="Real-time payment fraud detection"
      title={<>Fraud, caught in milliseconds.</>}
      subtitle="Sentinel scores every transaction the instant it arrives — auto-approving the clear ones, blocking fraud, and routing the uncertain few to a human with an explanation. A trained model at the core, not a wrapper around an API."
      primaryCta={{ label: "Open live console", onClick: () => router.push("/dashboard") }}
      proof={[
        { metric: "0.802", label: "PR-AUC on a future holdout" },
        { metric: "~2 ms", label: "ONNX scoring per transaction" },
        { metric: "0.17%", label: "fraud rate — the hard part" },
      ]}
    />
  );
}
