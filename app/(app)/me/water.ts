/** Water tracking helpers (EC-17). Amounts are in millilitres. */

export const MAX_WATER_ML = 20000;

/** Quick-add presets, carried over from the original artifact. */
export const WATER_PRESETS = [
  { label: "+ כוס", ml: 250 },
  { label: "+ בקבוק", ml: 750 },
] as const;

export function clampWater(ml: number): number {
  if (!Number.isFinite(ml)) return 0;
  return Math.min(MAX_WATER_ML, Math.max(0, Math.round(ml)));
}

/** Progress towards the goal as a whole percent in [0, 100]. */
export function waterPercent(ml: number, goalMl: number): number {
  if (goalMl <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((ml / goalMl) * 100)));
}
