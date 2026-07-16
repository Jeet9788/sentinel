"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// One easing curve for the whole app so every motion feels like the same system.
// A soft ease-out (fast start, gentle settle) reads as "responsive," which suits
// an ops tool better than a springy bounce.
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
};

/** Hover feedback for interactive cards. Drop into `whileHover`. */
export const hoverLift = { y: -3, transition: { duration: 0.18, ease: EASE } };

type Props = { children: ReactNode; className?: string; delay?: number };

/**
 * Scroll-triggered fade + rise, fired once when the element scrolls into view.
 * Safe to wrap around server-rendered children — it only animates its own box.
 */
export function FadeIn({ children, className, delay = 0 }: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Mount-triggered staggered container. Children should be <StaggerItem>. */
export function Stagger({ children, className }: Props) {
  return (
    <motion.div className={className} variants={staggerContainer} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/** Scroll-triggered staggered container, for lists below the fold. */
export function StaggerOnView({ children, className }: Props) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: Props) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}
