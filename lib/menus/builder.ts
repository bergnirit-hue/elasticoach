/**
 * EC-40 — the coach's in-app menu builder. This module holds the PURE,
 * DB-free validation of a menu draft so it is fully unit-testable (see
 * tests/menus-builder.test.ts). The server action (app/(app)/menus/actions.ts)
 * shapes FormData into a draft, validates it here, then writes it to Supabase.
 *
 * A menu, as built here, is:
 *   - a name and a publish date (the EC-11/EC-12 `menu` row),
 *   - a set of meals chosen from the coach's existing meal_library, plus any
 *     meals the coach creates inline during the flow (new library rows),
 *   - "applies to": all of the coach's clients, or one specific client.
 *
 * It deliberately builds on the EXISTING schema and engine — no new policy
 * logic. The availability engine (EC-12) keys off `menu.publish_date` and the
 * set of `menu_meal` links; this builder just produces valid inputs for it.
 *
 * CRITICAL (EC-39): meal types are the canonical HYPHENATED enum values
 * ("lunch-carb", "lunch-protein"), never underscores. Every value written here
 * is validated against MEAL_TYPES so a bad value can never reach the DB enum.
 */

import { isValidYmd, parse, ymd } from "@/lib/date";
import { MEAL_TYPES, type MealType } from "@/lib/menus/types";

export const MENU_NAME_MAX_LENGTH = 120;
export const MEAL_TEXT_MAX_LENGTH = 500;
export const RECIPE_URL_MAX_LENGTH = 2000;

/** Who a menu is published to. `all` = every active client of the coach. */
export type AppliesTo =
  | { kind: "all" }
  | { kind: "client"; clientId: string };

/** A meal the coach creates inline, to be inserted into the library. */
export interface NewMealDraft {
  type: MealType;
  text: string;
  recipeUrl?: string | null;
}

/** The raw, pre-validation draft the UI collects. */
export interface MenuDraft {
  name: string;
  publishDate: string;
  appliesTo: AppliesTo;
  /** Ids of meals picked from the coach's existing library. */
  selectedMealIds: string[];
  /** Meals typed inline during this flow (added to the library on save). */
  newMeals: NewMealDraft[];
}

/** A draft that passed validation; ready to persist. */
export interface ValidMenu {
  name: string;
  publishDate: string;
  appliesTo: AppliesTo;
  selectedMealIds: string[];
  newMeals: Required<NewMealDraft>[];
}

/** Context the validator needs to check a draft against reality. */
export interface MenuValidationContext {
  /** Ids of meals that exist in THIS coach's library (RLS-scoped by caller). */
  knownMealIds: Set<string> | readonly string[];
  /** Ids of this coach's actively-linked clients (for `appliesTo: client`). */
  clientIds: Set<string> | readonly string[];
}

export type MenuValidationResult =
  | { ok: true; menu: ValidMenu }
  | { ok: false; error: string };

function isMealType(v: unknown): v is MealType {
  return typeof v === "string" && (MEAL_TYPES as readonly string[]).includes(v);
}

function asSet(ids: Set<string> | readonly string[]): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

/**
 * Validate a menu draft. Returns the clean menu or the first Hebrew error.
 * Pure: no I/O. The caller supplies the known meal / client ids it may use.
 */
export function validateMenuDraft(
  draft: MenuDraft,
  ctx: MenuValidationContext,
): MenuValidationResult {
  // --- name -------------------------------------------------------------
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "יש להזין שם לתפריט" };
  if (name.length > MENU_NAME_MAX_LENGTH) {
    return { ok: false, error: `שם התפריט: עד ${MENU_NAME_MAX_LENGTH} תווים` };
  }

  // --- publish date -----------------------------------------------------
  // isValidYmd checks shape only; the round-trip rejects impossible calendar
  // dates (e.g. 2026-13-01) so the DB never sees a bad date.
  if (!isValidYmd(draft.publishDate) || ymd(parse(draft.publishDate)) !== draft.publishDate) {
    return { ok: false, error: "תאריך פרסום לא תקין" };
  }

  // --- applies to -------------------------------------------------------
  const applies = draft.appliesTo;
  if (applies.kind !== "all" && applies.kind !== "client") {
    return { ok: false, error: "ערך ״חל על״ לא תקין" };
  }
  if (applies.kind === "client") {
    const clients = asSet(ctx.clientIds);
    if (!applies.clientId || !clients.has(applies.clientId)) {
      return { ok: false, error: "המתאמן/ת אינם משויכים אליך" };
    }
  }

  // --- new meals (created inline) ---------------------------------------
  const newMeals: Required<NewMealDraft>[] = [];
  for (const m of draft.newMeals) {
    if (!isMealType(m.type)) {
      return { ok: false, error: "סוג ארוחה לא חוקי" };
    }
    const text = m.text.trim();
    if (!text) return { ok: false, error: "למנה חדשה חובה טקסט" };
    if (text.length > MEAL_TEXT_MAX_LENGTH) {
      return { ok: false, error: `טקסט מנה: עד ${MEAL_TEXT_MAX_LENGTH} תווים` };
    }
    const recipeUrl = (m.recipeUrl ?? "").trim();
    if (recipeUrl) {
      if (recipeUrl.length > RECIPE_URL_MAX_LENGTH || !isHttpUrl(recipeUrl)) {
        return { ok: false, error: "קישור מתכון לא תקין (צריך להתחיל ב-http/https)" };
      }
    }
    newMeals.push({ type: m.type, text, recipeUrl: recipeUrl || null });
  }

  // --- selected library meals -------------------------------------------
  const known = asSet(ctx.knownMealIds);
  const selectedMealIds: string[] = [];
  const seen = new Set<string>();
  for (const id of draft.selectedMealIds) {
    if (typeof id !== "string" || id === "") continue;
    if (!known.has(id)) {
      // A meal that is not in the coach's library must never enter a menu.
      return { ok: false, error: "נבחרה מנה שאינה במאגר שלך" };
    }
    if (seen.has(id)) continue; // de-dupe silently
    seen.add(id);
    selectedMealIds.push(id);
  }

  // --- at least one meal ------------------------------------------------
  if (selectedMealIds.length === 0 && newMeals.length === 0) {
    return { ok: false, error: "יש לבחור לפחות מנה אחת לתפריט" };
  }

  return {
    ok: true,
    menu: { name, publishDate: draft.publishDate, appliesTo: applies, selectedMealIds, newMeals },
  };
}

/** Accept only absolute http(s) URLs (recipe links). */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// FormData → draft (pure; used by the server action)
// ---------------------------------------------------------------------------

export interface FormLike {
  get(key: string): unknown;
  getAll(key: string): unknown[];
}

/**
 * Shape a submitted form into a MenuDraft. New meals arrive as parallel arrays
 * (new_meal_type[i], new_meal_text[i], new_meal_url[i]); blank rows are dropped.
 */
export function menuDraftFromForm(form: FormLike): MenuDraft {
  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };

  const appliesKind = str("applies_to");
  const clientId = str("applies_client_id").trim();
  const appliesTo: AppliesTo =
    appliesKind === "client" ? { kind: "client", clientId } : { kind: "all" };

  const selectedMealIds = form
    .getAll("meal_id")
    .filter((v): v is string => typeof v === "string" && v !== "");

  const types = form.getAll("new_meal_type");
  const texts = form.getAll("new_meal_text");
  const urls = form.getAll("new_meal_url");
  const newMeals: NewMealDraft[] = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const text = typeof texts[i] === "string" ? (texts[i] as string) : "";
    const url = typeof urls[i] === "string" ? (urls[i] as string) : "";
    // A new meal is defined by its text. Drop rows the coach added but left
    // blank (the type hidden input is always present), so an empty row never
    // blocks the save. A row with text but a bad type still surfaces an error.
    if (text.trim() === "") continue;
    newMeals.push({
      type: type as MealType,
      text,
      recipeUrl: url.trim() || null,
    });
  }

  return {
    name: str("name"),
    publishDate: str("publish_date"),
    appliesTo,
    selectedMealIds,
    newMeals,
  };
}
