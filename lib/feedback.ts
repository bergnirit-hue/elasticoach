/**
 * Coach feedback (EC-16) — pure helpers shared by the coach UI.
 *
 * A feedback row targets either the whole day (meal_key = null) or one eating
 * journal slot. The slot keys mirror the client's day tracker
 * (app/(app)/me/DayTracker.tsx) so feedback lines up with what the client sees.
 */

export interface Feedback {
  id: string;
  coach_id: string;
  client_id: string;
  date: string;
  meal_key: string | null;
  body: string;
}

/** Eating journal slots a coach can comment on, in display order. */
export const MEAL_SLOTS: { key: string; label: string }[] = [
  { key: "breakfast", label: "בוקר" },
  { key: "lunch", label: "צהריים" },
  { key: "dinner", label: "ערב" },
  { key: "snacks", label: "ביניים" },
  { key: "notes", label: "תחושות, רעב ושובע" },
];

/** Sentinel the UI uses for "feedback on the whole day" (stored as null). */
export const DAY_TARGET = "__day__";

const MEAL_LABELS: Record<string, string> = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s.key, s.label]),
);

/** Human label for a feedback target. null (or the day sentinel) = whole day. */
export function targetLabel(mealKey: string | null): string {
  if (mealKey === null || mealKey === DAY_TARGET) return "היום";
  return MEAL_LABELS[mealKey] ?? mealKey;
}

/** True for a meal key the client tracker actually exposes. */
export function isMealKey(value: string): boolean {
  return value in MEAL_LABELS;
}

/**
 * Normalize a target coming from the UI into the stored `meal_key`:
 * the day sentinel and unknown values collapse to null (whole day).
 */
export function toMealKey(target: string | null): string | null {
  if (target === null || target === DAY_TARGET) return null;
  return isMealKey(target) ? target : null;
}

/** Trim a feedback body; empty / whitespace-only becomes null (nothing to save). */
export function cleanBody(body: string | null | undefined): string | null {
  const trimmed = (body ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Group feedback rows by target key, so a day view can show each note next to
 * the meal it is about. Whole-day notes land under DAY_TARGET.
 */
export function groupByTarget(rows: Feedback[]): Record<string, Feedback[]> {
  const out: Record<string, Feedback[]> = {};
  for (const row of rows) {
    const key = row.meal_key ?? DAY_TARGET;
    (out[key] ??= []).push(row);
  }
  return out;
}
