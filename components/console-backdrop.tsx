"use client";

import { LiquidMetal, liquidMetalPresets } from "@paper-design/shaders-react";
import { useReducedMotion } from "framer-motion";

/**
 * The landing hero's liquid metal, carried into the console with the lights
 * turned down: same shader, same colors, slowed and heavily veiled so the data
 * stays legible. The glass panels blur over it — every page is visibly lit by
 * the same material the hero is made of.
 */
export function ConsoleBackdrop() {
  const reducedMotion = useReducedMotion();

  return (
    <>
      <LiquidMetal
        {...liquidMetalPresets[2].params}
        colorBack="#090c11"
        colorTint="#4c8df6"
        speed={reducedMotion ? 0 : 0.15}
        softness={0.4}
        repetition={1.1}
        contour={0.32}
        shiftRed={0.05}
        shiftBlue={0.05}
        scale={1.15}
        style={{ position: "fixed", inset: 0, zIndex: -20 }}
      />
      {/* The veil: the metal shines through at the top edge — where the landing
          is brightest — and falls to near-solid where the tables live. */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 0%, rgba(9, 12, 17, 0.6) 0%, rgba(9, 12, 17, 0.88) 52%, rgba(9, 12, 17, 0.97) 100%)",
        }}
      />
    </>
  );
}
