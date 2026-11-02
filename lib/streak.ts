import { addDays } from "./date";

/**
 * Streaks over a set of dates where some condition held (e.g. the water goal
 * was met). Dates are `YYYY-MM-DD` strings.
 *
 * `currentStreak` counts consecutive days ending at today. Today not yet being
 * logged does not break the streak — it is treated as "in progress", so the
 * count continues from yesterday.
 */
export function currentStreak(met: Set<string>, today: string): number {
  let streak = 0;
  let d = met.has(today) ? today : addDays(today, -1);
  while (met.has(d)) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

/** Longest run of consecutive met days within [from, to] (inclusive). */
export function longestStreak(
  met: Set<string>,
  from: string,
  to: string,
): number {
  let best = 0;
  let run = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (met.has(d)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}
