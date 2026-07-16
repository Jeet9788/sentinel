"use client";

import { LiquidMetal, liquidMetalPresets } from "@paper-design/shaders-react";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Same easing the rest of the app uses, so the landing feels like the product.
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Cta = { label: string; onClick: () => void };

interface LiquidMetalHeroProps {
  badge?: string;
  title: ReactNode;
  subtitle: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  features?: string[];
}

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.15, staggerChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const rise: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE } },
};

export function LiquidMetalHero({
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  features = [],
}: LiquidMetalHeroProps) {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Liquid-metal shader, recolored from silver/white to Sentinel's navy + brand blue. */}
      <LiquidMetal
        {...liquidMetalPresets[2].params}
        colorBack="#0b0e13"
        colorTint="#4c8df6"
        speed={0.7}
        style={{ position: "fixed", inset: 0, zIndex: -10 }}
      />
      {/* Vignette so the shader never fights the type for legibility. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 45%, rgba(11,14,19,0.35) 0%, rgba(11,14,19,0.78) 100%)",
        }}
      />

      <div className="container mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div
          className="space-y-8 text-center"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {badge && (
            <motion.div className="flex justify-center" variants={item}>
              <Badge
                variant="secondary"
                className="border-foreground/15 bg-foreground/10 text-foreground backdrop-blur-sm transition-colors hover:bg-foreground/15"
              >
                {badge}
              </Badge>
            </motion.div>
          )}

          <motion.div className="space-y-5" variants={item}>
            <motion.h1
              className="text-balance text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-heading)" }}
              variants={item}
            >
              {title}
            </motion.h1>

            <motion.p
              className="mx-auto max-w-2xl text-lg leading-relaxed text-foreground/80 sm:text-xl"
              variants={item}
            >
              {subtitle}
            </motion.p>
          </motion.div>

          <motion.div
            className="flex flex-col items-center justify-center gap-3 sm:flex-row"
            variants={item}
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={primaryCta.onClick}
                size="lg"
                className="bg-foreground px-7 text-base font-semibold text-background shadow-xl hover:bg-foreground/90"
              >
                {primaryCta.label}
              </Button>
            </motion.div>

            {secondaryCta && (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={secondaryCta.onClick}
                  variant="outline"
                  size="lg"
                  className="border-foreground/25 bg-transparent px-7 text-base font-semibold text-foreground backdrop-blur-sm hover:bg-foreground/10"
                >
                  {secondaryCta.label}
                </Button>
              </motion.div>
            )}
          </motion.div>

          {features.length > 0 && (
            <motion.div className="pt-8" variants={rise}>
              <Card className="border-foreground/12 bg-foreground/[0.06] py-0 backdrop-blur-md">
                <div className="grid gap-px overflow-hidden rounded-xl sm:grid-cols-3">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature}
                      className="px-6 py-5 text-center"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.7 + index * 0.12 }}
                    >
                      <p className="text-sm font-medium text-foreground/90 sm:text-base">{feature}</p>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
