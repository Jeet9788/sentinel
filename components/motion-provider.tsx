"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * App-wide motion settings. `reducedMotion="user"` makes every Framer animation
 * honor the OS "reduce motion" preference automatically — accessibility for free.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
