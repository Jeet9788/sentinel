"use client";

import { LiquidMetal, liquidMetalPresets } from "@paper-design/shaders-react";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

// Same easing the rest of the app uses, so the landing feels like the product.
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Cta = { label: string; onClick: () => void };
type Proof = { metric: string; label: string };

interface LiquidMetalHeroProps {
  badge?: string;
  title: ReactNode;
  subtitle: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  proof?: Proof[];
}

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.15, staggerChildren: 0.11 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } },
};

export function LiquidMetalHero({
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  proof = [],
}: LiquidMetalHeroProps) {
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Liquid-metal shader, recolored from the stock silver to Sentinel's navy +
          brand blue, and calmed: the chromatic dispersion is dialed almost off and
          the flow slowed, so it reads as still dark metal rather than a busy demo. */}
      <LiquidMetal
        {...liquidMetalPresets[2].params}
        colorBack="#090c11"
        colorTint="#4c8df6"
        speed={0.4}
        softness={0.4}
        repetition={1.1}
        contour={0.32}
        shiftRed={0.05}
        shiftBlue={0.05}
        scale={1.15}
        style={{ position: "fixed", inset: 0, zIndex: -20 }}
      />
      {/* Vignette so the metal never fights the type, darkest at the edges. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(58% 58% at 50% 42%, rgba(9,12,17,0.30) 0%, rgba(9,12,17,0.82) 100%)",
        }}
      />

      {/* Minimal brand bar — presence without chrome. */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold text-background"
            style={{ backgroundColor: "var(--series)", fontFamily: "var(--font-heading)" }}
          >
            S
          </span>
          <span
            className="text-[15px] font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Sentinel
          </span>
        </div>
        {secondaryCta && (
          <button
            onClick={secondaryCta.onClick}
            className="text-sm text-foreground/70 transition-colors hover:text-foreground"
          >
            {secondaryCta.label}
          </button>
        )}
      </motion.header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16 lg:px-8">
        <motion.div
          className="w-full max-w-4xl space-y-8 text-center"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {badge && (
            <motion.div className="flex justify-center" variants={item}>
              <span className="inline-flex items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.06] px-3.5 py-1.5 text-xs font-medium text-foreground/85 backdrop-blur-md">
                <span
                  className="pulse-dot h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--series)" }}
                />
                {badge}
              </span>
            </motion.div>
          )}

          <motion.h1
            className="text-balance text-5xl font-bold leading-[1.02] tracking-[-0.02em] text-foreground sm:text-6xl lg:text-[5.25rem]"
            style={{ fontFamily: "var(--font-heading)" }}
            variants={item}
          >
            {title}
          </motion.h1>

          <motion.p
            className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-foreground/75 sm:text-xl"
            variants={item}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="flex flex-col items-center justify-center gap-3 sm:flex-row"
            variants={item}
          >
            <motion.div whileHover={{ scale: 1.035 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={primaryCta.onClick}
                size="lg"
                className="bg-foreground px-8 text-base font-semibold text-background shadow-[0_8px_30px_-8px_rgba(76,141,246,0.5)] hover:bg-foreground/90"
              >
                {primaryCta.label}
              </Button>
            </motion.div>

            {secondaryCta && (
              <motion.div whileHover={{ scale: 1.035 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={secondaryCta.onClick}
                  variant="outline"
                  size="lg"
                  className="border-foreground/20 bg-foreground/[0.04] px-8 text-base font-semibold text-foreground backdrop-blur-md hover:bg-foreground/10"
                >
                  {secondaryCta.label}
                </Button>
              </motion.div>
            )}
          </motion.div>

          {proof.length > 0 && (
            <motion.div className="pt-8" variants={rise}>
              <div className="mx-auto grid max-w-3xl grid-cols-1 divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.05] backdrop-blur-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {proof.map((entry, index) => (
                  <motion.div
                    key={entry.label}
                    className="px-6 py-6"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: EASE, delay: 0.75 + index * 0.12 }}
                  >
                    <p
                      className="text-2xl font-semibold tracking-tight text-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {entry.metric}
                    </p>
                    <p className="mt-1 text-[13px] text-foreground/60">{entry.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
