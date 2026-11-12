"use client";

import { useId } from "react";

/**
 * A water bottle that fills with the day's intake — the signature liquid
 * visual. The level rises smoothly toward the goal and a surface wave travels
 * across it (two waves at different speeds for depth). The reduced-motion rule
 * in globals.css freezes the wave, leaving a still, correctly-filled bottle.
 */
type Props = {
  /** 0–100, how full toward the goal. */
  pct: number;
  label?: string;
};

// Interior geometry (viewBox units). The liquid group's own surface sits at
// y=0; we translate it down so the surface lands on `fillLine`.
const TOP = 15;
const BOTTOM = 97;
const HEIGHT = BOTTOM - TOP;
// One wavy band, wide enough that a 32px horizontal loop never exposes an edge.
const WAVE =
  "M2 4 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 L82 96 L2 96 Z";

export function WaterFill({ pct, label }: Props) {
  const clipId = useId();
  const clamped = Math.min(100, Math.max(0, pct));
  const fillLine = BOTTOM - (clamped / 100) * HEIGHT;

  return (
    <svg
      viewBox="0 0 64 104"
      width={72}
      height={104}
      className="flex-none"
      role="img"
      aria-label={label ?? `מים: ${Math.round(clamped)}% מהיעד`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="14" y={TOP} width="36" height={HEIGHT} rx="12" />
        </clipPath>
      </defs>

      {/* cap + bottle body */}
      <rect x="25" y="3" width="14" height="10" rx="3" fill="var(--water)" />
      <rect
        x="12"
        y="13"
        width="40"
        height="86"
        rx="15"
        fill="var(--water-soft)"
        stroke="var(--water)"
        strokeWidth="2"
      />

      {/* liquid */}
      <g clipPath={`url(#${clipId})`}>
        <g
          style={{
            transform: `translateY(${fillLine}px)`,
            transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <g className="water-wave water-wave-back">
            <path d={WAVE} fill="var(--water)" transform="translateY(2)" />
          </g>
          <g className="water-wave water-wave-front">
            <path d={WAVE} fill="var(--water)" />
          </g>
        </g>
      </g>
    </svg>
  );
}
