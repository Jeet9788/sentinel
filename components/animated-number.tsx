"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";

/**
 * A numeral that counts to its value — on mount and on every live update, so
 * the dashboard's numbers visibly *move* when the stream does. Honors reduced
 * motion by snapping instead.
 */
export function AnimatedNumber({
  value,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const motionValue = useMotionValue(0);
  const reduced = useReducedMotion();
  const text = useTransform(motionValue, (v) => format(Math.round(v)));

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, motionValue, reduced]);

  return <motion.span>{text}</motion.span>;
}
