/** Body measurements (EC-17): types, validation and history helpers. */

export const CIRCUMFERENCES = [
  { key: "waist", label: "מותניים" },
  { key: "hips", label: "ירכיים" },
  { key: "chest", label: "חזה" },
  { key: "arm", label: "זרוע" },
  { key: "thigh", label: "ירך עליונה" },
] as const;

export type CircumferenceKey = (typeof CIRCUMFERENCES)[number]["key"];

/** A row of `public.measures` as the UI uses it. */
export type Measure = {
  date: string;
  weight: number | null;
  body_fat_pct: number | null;
  muscle_pct: number | null;
  circumferences: Partial<Record<CircumferenceKey, number>>;
};

/** Raw form input: every field is the string the user typed. */
export type MeasureInput = {
  date: string;
  weight: string;
  bodyFatPct: string;
  musclePct: string;
  circumferences: Partial<Record<CircumferenceKey, string>>;
};

export type MeasureValues = Omit<Measure, "date">;

type Range = { min: number; max: number };
const WEIGHT: Range = { min: 20, max: 400 };
const PERCENT: Range = { min: 1, max: 90 };
const CIRC: Range = { min: 10, max: 300 };

/** `""` → null (not entered), a number in range → number, anything else → error. */
function parseField(
  raw: string | undefined,
  range: Range,
  label: string,
): { value: number | null; error?: string } {
  const s = (raw ?? "").trim().replace(",", ".");
  if (s === "") return { value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < range.min || n > range.max) {
    return { value: null, error: `${label}: ערך בין ${range.min} ל-${range.max}` };
  }
  return { value: Math.round(n * 10) / 10 };
}

export function parseMeasureInput(
  input: Omit<MeasureInput, "date">,
): { ok: true; values: MeasureValues } | { ok: false; error: string } {
  const weight = parseField(input.weight, WEIGHT, "משקל");
  const fat = parseField(input.bodyFatPct, PERCENT, "אחוז שומן");
  const muscle = parseField(input.musclePct, PERCENT, "אחוז שריר");
  const errors = [weight.error, fat.error, muscle.error];

  const circumferences: Measure["circumferences"] = {};
  for (const { key, label } of CIRCUMFERENCES) {
    const c = parseField(input.circumferences?.[key], CIRC, label);
    errors.push(c.error);
    if (c.value !== null) circumferences[key] = c.value;
  }

  const firstError = errors.find(Boolean);
  if (firstError) return { ok: false, error: firstError };

  const values: MeasureValues = {
    weight: weight.value,
    body_fat_pct: fat.value,
    muscle_pct: muscle.value,
    circumferences,
  };
  const empty =
    values.weight === null &&
    values.body_fat_pct === null &&
    values.muscle_pct === null &&
    Object.keys(circumferences).length === 0;
  if (empty) return { ok: false, error: "הזיני לפחות מדידה אחת" };
  return { ok: true, values };
}

/** Coerce a `circumferences` jsonb cell into known keys with numeric values. */
export function normalizeCircumferences(raw: unknown): Measure["circumferences"] {
  const out: Measure["circumferences"] = {};
  if (typeof raw !== "object" || raw === null) return out;
  const rec = raw as Record<string, unknown>;
  for (const { key } of CIRCUMFERENCES) {
    const v = rec[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/**
 * Weight change of each entry against the previous entry that has a weight.
 * Input must be sorted newest first (as the page loads it); the oldest entry
 * (and entries without weight) get `null`.
 */
export function weightDeltas(
  newestFirst: Pick<Measure, "date" | "weight">[],
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  newestFirst.forEach((m, i) => {
    if (m.weight === null) return out.set(m.date, null);
    const prev = newestFirst.slice(i + 1).find((p) => p.weight !== null);
    out.set(
      m.date,
      prev ? Math.round((m.weight - (prev.weight as number)) * 10) / 10 : null,
    );
  });
  return out;
}
