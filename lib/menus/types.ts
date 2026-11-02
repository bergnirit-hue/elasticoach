/**
 * Shared menu types (EC-11 / EC-12). Kept DB-free so the availability logic and
 * the import parser can be unit-tested without Supabase.
 *
 * Values mirror the Postgres enums in supabase/migrations/0003_ec11_ec12_menus.sql.
 */

/** Meal slot in a day. Matches the `meal_type` enum. */
export type MealType =
  | "breakfast"
  | "lunch-carb"
  | "lunch-protein"
  | "dinner"
  | "snack";

export const MEAL_TYPES: readonly MealType[] = [
  "breakfast",
  "lunch-carb",
  "lunch-protein",
  "dinner",
  "snack",
] as const;

/** How a coach exposes menus to a client. Matches the `menu_policy` enum. */
export type MenuPolicy = "fixed" | "rotating" | "cumulative" | "full_pool";

export const MENU_POLICIES: readonly MenuPolicy[] = [
  "fixed",
  "rotating",
  "cumulative",
  "full_pool",
] as const;

export const DEFAULT_MENU_POLICY: MenuPolicy = "fixed";

/** A meal as stored in the library. Macros are optional. */
export interface Meal {
  id: string;
  type: MealType;
  text: string;
  recipeUrl?: string | null;
  proteinG?: number | null;
  carbG?: number | null;
  fatG?: number | null;
}
