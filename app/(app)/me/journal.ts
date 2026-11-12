/**
 * Eating + feelings journal (EC-14). Stored as-is in `days.journal` (jsonb).
 *
 * Shape: `{ meals: [{ id, type, text }], mood: 1..5 | null, notes }`.
 * Rows written by the first version of the day view used free-text slots
 * (`breakfast`, `lunch`, `dinner`, `snacks`, `notes`); `normalizeJournal`
 * reads those too, so no data is lost and no migration is needed.
 */

export const MEAL_TYPES = [
  { key: "breakfast", label: "בוקר" },
  { key: "lunch", label: "צהריים" },
  { key: "dinner", label: "ערב" },
  { key: "snack", label: "ביניים" },
] as const;

export type MealType = (typeof MEAL_TYPES)[number]["key"];

export const MOODS = [
  { value: 1, emoji: "😞", label: "קשה" },
  { value: 2, emoji: "😕", label: "לא משהו" },
  { value: 3, emoji: "😐", label: "בסדר" },
  { value: 4, emoji: "🙂", label: "טוב" },
  { value: 5, emoji: "😄", label: "מצוין" },
] as const;

export type Mood = (typeof MOODS)[number]["value"];

export type JournalMeal = { id: string; type: MealType; text: string };

export type Journal = {
  meals: JournalMeal[];
  mood: Mood | null;
  notes: string;
};

export const MAX_MEALS = 30;
export const MAX_MEAL_TEXT = 500;
export const MAX_NOTES = 2000;

export const emptyJournal = (): Journal => ({ meals: [], mood: null, notes: "" });

const MEAL_KEYS = new Set<string>(MEAL_TYPES.map((m) => m.key));
const isMealType = (v: unknown): v is MealType =>
  typeof v === "string" && MEAL_KEYS.has(v);
const isMood = (v: unknown): v is Mood =>
  typeof v === "number" && MOODS.some((m) => m.value === v);

const newId = () => globalThis.crypto.randomUUID();

/** Legacy free-text slot → meal type. */
const LEGACY_SLOTS: [string, MealType][] = [
  ["breakfast", "breakfast"],
  ["lunch", "lunch"],
  ["dinner", "dinner"],
  ["snacks", "snack"],
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Tolerant reader: accepts the current shape, the legacy slot shape, or junk
 * (`null`, `{}`, wrong types) and always returns a valid `Journal`. Blank meals
 * are kept so a row being edited does not vanish; use `cleanJournal` to save.
 */
export function normalizeJournal(raw: unknown): Journal {
  if (!isRecord(raw)) return emptyJournal();

  const meals: JournalMeal[] = [];
  if (Array.isArray(raw.meals)) {
    for (const m of raw.meals) {
      if (!isRecord(m) || typeof m.text !== "string") continue;
      meals.push({
        id: typeof m.id === "string" && m.id ? m.id.slice(0, 64) : newId(),
        type: isMealType(m.type) ? m.type : "snack",
        text: m.text.slice(0, MAX_MEAL_TEXT),
      });
    }
  } else {
    for (const [slot, type] of LEGACY_SLOTS) {
      const text = raw[slot];
      if (typeof text === "string" && text.trim()) {
        meals.push({
          id: `legacy-${slot}`,
          type,
          text: text.trim().slice(0, MAX_MEAL_TEXT),
        });
      }
    }
  }

  return {
    meals: meals.slice(0, MAX_MEALS),
    mood: isMood(raw.mood) ? raw.mood : null,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, MAX_NOTES) : "",
  };
}

/** What gets persisted: normalized, with blank meals dropped and text trimmed. */
export function cleanJournal(raw: unknown): Journal {
  const j = normalizeJournal(raw);
  return {
    meals: j.meals
      .map((m) => ({ ...m, text: m.text.trim() }))
      .filter((m) => m.text !== ""),
    mood: j.mood,
    notes: j.notes.trim(),
  };
}
