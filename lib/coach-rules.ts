/**
 * Coach rules are structured fields (table `coach_rules`), never hardcoded in
 * code or prompts (see CLAUDE.md, Coach Brain). A row is either the coach's
 * default (client_id = null) or a per-client override. Every rule field is
 * nullable: null means "not set here — inherit".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const MEAL_TYPES = [
  "breakfast",
  "lunch_carb",
  "lunch_protein",
  "dinner",
  "snack",
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "ארוחת בוקר",
  lunch_carb: "ארוחת צהריים — פחמימה",
  lunch_protein: "ארוחת צהריים — חלבון",
  dinner: "ארוחת ערב",
  snack: "נשנוש",
};

export const NOTES_MAX_LENGTH = 1000;

/** The rule fields, as stored. Same shape for a default and for an override. */
export interface CoachRuleFields {
  allowed_meal_types: MealType[] | null;
  forbidden_meal_tags: string[] | null;
  water_goal_ml: number | null;
  protein_goal_g: number | null;
  weekly_workout_goal: number | null;
  notes: string | null;
}

export interface CoachRulesRow extends CoachRuleFields {
  id: string;
  coach_id: string;
  client_id: string | null;
}

/** Rules after layering; null = no rule set at either layer. */
export type EffectiveRules = CoachRuleFields;

export const EMPTY_RULES: EffectiveRules = {
  allowed_meal_types: null,
  forbidden_meal_tags: null,
  water_goal_ml: null,
  protein_goal_g: null,
  weekly_workout_goal: null,
  notes: null,
};

const RULE_KEYS = Object.keys(EMPTY_RULES) as (keyof CoachRuleFields)[];

/**
 * Layer the client override over the coach default, field by field: a non-null
 * override field wins, otherwise the default's value is used. Rows belonging to
 * another coach or another client are ignored, so it is safe to pass whatever
 * the (RLS-filtered) query returned.
 */
export function resolveEffectiveRules(
  rows: CoachRulesRow[],
  coachId: string,
  clientId?: string | null,
): EffectiveRules {
  const mine = rows.filter((r) => r.coach_id === coachId);
  const base = mine.find((r) => r.client_id === null);
  const override = clientId
    ? mine.find((r) => r.client_id === clientId)
    : undefined;

  const effective: EffectiveRules = { ...EMPTY_RULES };
  for (const layer of [base, override]) {
    if (!layer) continue;
    for (const key of RULE_KEYS) {
      if (layer[key] !== null && layer[key] !== undefined) {
        // Same key on both sides, so the value type matches.
        (effective as unknown as Record<string, unknown>)[key] = layer[key];
      }
    }
  }
  return effective;
}

export interface MealForRules {
  type: string;
  tags?: string[] | null;
}

/**
 * Enforcement helper: is this meal permitted under the rules? Code calls this
 * to validate what is shown or suggested (e.g. AI output) — a rule that is not
 * set never blocks.
 */
export function isMealAllowed(rules: EffectiveRules, meal: MealForRules): boolean {
  if (
    rules.allowed_meal_types &&
    !(rules.allowed_meal_types as string[]).includes(meal.type)
  ) {
    return false;
  }
  if (rules.forbidden_meal_tags && meal.tags) {
    const forbidden = new Set(rules.forbidden_meal_tags.map(normalizeTag));
    if (meal.tags.some((t) => forbidden.has(normalizeTag(t)))) return false;
  }
  return true;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Form parsing (pure — used by the server action)
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; fields: CoachRuleFields }
  | { ok: false; error: string };

const NUMBER_FIELDS: {
  key: "water_goal_ml" | "protein_goal_g" | "weekly_workout_goal";
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "water_goal_ml", label: "יעד מים", min: 0, max: 20000 },
  { key: "protein_goal_g", label: "יעד חלבון", min: 0, max: 1000 },
  { key: "weekly_workout_goal", label: "אימונים בשבוע", min: 0, max: 21 },
];

/** Split a comma / newline separated tag list; trims, drops empties, dedupes. */
export function parseTagList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n،]/)) {
    const tag = part.trim();
    const key = normalizeTag(tag);
    if (tag && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

/**
 * Validate form input into rule fields. Empty input becomes null ("not set /
 * inherit"). Returns a Hebrew error message for the first invalid field.
 */
export function parseRulesForm(input: {
  get(key: string): unknown;
  getAll(key: string): unknown[];
}): ParseResult {
  const str = (key: string) => {
    const v = input.get(key);
    return typeof v === "string" ? v.trim() : "";
  };

  const types = input
    .getAll("allowed_meal_types")
    .filter((v): v is string => typeof v === "string");
  const badType = types.find((t) => !(MEAL_TYPES as readonly string[]).includes(t));
  if (badType) return { ok: false, error: "סוג ארוחה לא חוקי" };

  const fields: CoachRuleFields = { ...EMPTY_RULES };
  fields.allowed_meal_types = types.length ? (types as MealType[]) : null;

  const tags = parseTagList(str("forbidden_meal_tags"));
  fields.forbidden_meal_tags = tags.length ? tags : null;

  for (const { key, label, min, max } of NUMBER_FIELDS) {
    const raw = str(key);
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      return { ok: false, error: `${label}: יש להזין מספר שלם בין ${min} ל-${max}` };
    }
    fields[key] = n;
  }

  const notes = str("notes");
  if (notes.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: `הערות: עד ${NOTES_MAX_LENGTH} תווים` };
  }
  fields.notes = notes || null;

  return { ok: true, fields };
}

// ---------------------------------------------------------------------------
// Typed accessors (RLS filters what each caller may see)
// ---------------------------------------------------------------------------

const COLUMNS =
  "id, coach_id, client_id, allowed_meal_types, forbidden_meal_tags, water_goal_ml, protein_goal_g, weekly_workout_goal, notes";

/** The coach's default row plus, if given, the override for one client. */
export async function getCoachRuleRows(
  supabase: SupabaseClient,
  coachId: string,
  clientId?: string | null,
): Promise<CoachRulesRow[]> {
  let query = supabase.from("coach_rules").select(COLUMNS).eq("coach_id", coachId);
  query = clientId
    ? query.or(`client_id.is.null,client_id.eq.${clientId}`)
    : query.is("client_id", null);
  const { data, error } = await query;
  if (error) throw new Error(`coach_rules: ${error.message}`);
  return (data ?? []) as CoachRulesRow[];
}

/** Effective rules of `coachId` as they apply to `clientId` (or the default). */
export async function getEffectiveRules(
  supabase: SupabaseClient,
  coachId: string,
  clientId?: string | null,
): Promise<EffectiveRules> {
  const rows = await getCoachRuleRows(supabase, coachId, clientId);
  return resolveEffectiveRules(rows, coachId, clientId);
}
