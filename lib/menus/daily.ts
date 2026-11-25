/**
 * EC-13 — the daily plan + cross-menu swap, built ENTIRELY on top of the EC-12
 * availability engine (`availableMeals`). This module adds no availability logic
 * of its own: it asks `availableMeals` which meals are allowed for the client on
 * the date under the policy, then shapes that pool into a day's plan (one slot
 * per meal type) and the per-slot swap options.
 *
 * A "day" has at most one meal of each `MealType` (breakfast / lunch-carb /
 * lunch-protein / dinner / snack). The base plan is sourced from the client's
 * primary (most relevant) published menu; the swap list for each slot is every
 * OTHER meal of the same type that the policy makes available — cross-menu.
 *
 * Decisions (confirmed against docs/mvp-spec.md EC-13 / EC-12; see the PR body
 * for the ones still open):
 *   - Swap is hidden entirely under `fixed` (nothing to swap).  → swapEnabled
 *   - rotating/cumulative/full_pool expose same-type alternatives from the pool.
 *   - The client's chosen swaps are persisted per day in `days.menu_picks`
 *     (spec line 119) and override the base meal for that slot, as long as the
 *     picked meal is still available under the policy.
 *   - Coach swap-rules enforcement (EC-30) on top of this is only a PROPOSAL in
 *     the spec (line 120), so it is NOT applied here — flagged as open.
 */

import {
  availableMeals,
  type AvailabilityMenu,
} from "@/lib/menus/availability";
import type { Meal, MealType, MenuPolicy } from "@/lib/menus/types";
import { MEAL_TYPES } from "@/lib/menus/types";

/** The client's saved swaps for a day: meal type → chosen meal id. */
export type MenuPicks = Partial<Record<MealType, string>>;

export interface DailyPlanInput {
  policy: MenuPolicy;
  /** All of the coach's menus the client can see (publish gating done by RLS). */
  menus: AvailabilityMenu[];
  /** The meal library rows referenced by those menus. */
  meals: Meal[];
  /** The client's "today", `YYYY-MM-DD`. */
  date: string;
  /** `rotating` only: passed straight through to the availability engine. */
  rotationAnchor?: string;
  /** The client's saved picks for this date (from `days.menu_picks`). */
  picks?: MenuPicks | null;
}

export interface DailyPlanSlot {
  type: MealType;
  /** The meal shown for this slot (the pick when valid, else the base meal). */
  meal: Meal;
  /** The menu's default meal for this slot (what "reset" returns to). */
  baseMeal: Meal;
  /** True when `meal` came from a saved pick rather than the base menu. */
  picked: boolean;
  /** Same-type meals available under the policy, excluding `meal`. For swap. */
  alternatives: Meal[];
}

export interface DailyPlan {
  policy: MenuPolicy;
  /** The menu the base plan is drawn from, or null when nothing is available. */
  primaryMenuId: string | null;
  /** One slot per meal type present in the primary menu, in MEAL_TYPES order. */
  slots: DailyPlanSlot[];
  /** False under `fixed`: the swap button must be hidden. */
  swapEnabled: boolean;
  /**
   * Every available meal id per type (base meal included). The authority for
   * validating a pick server-side — a pick outside this set is rejected.
   */
  allowedByType: Record<MealType, string[]>;
}

const emptyAllowed = (): Record<MealType, string[]> => ({
  breakfast: [],
  "lunch-carb": [],
  "lunch-protein": [],
  dinner: [],
  snack: [],
});

/**
 * Build the daily plan + swap options for a client on a date.
 *
 * Pure and DB-free so it is fully unit-testable. The caller loads the policy,
 * the client's visible menus + meals and the saved picks from Supabase, then
 * hands them here.
 */
export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const { policy, menus, meals, date, rotationAnchor, picks } = input;

  const swapEnabled = policy !== "fixed";
  const mealById = new Map(meals.map((m) => [m.id, m]));

  // The single source of truth for availability (EC-12).
  const avail = availableMeals({ policy, menus, date, rotationAnchor });
  const availableIds = new Set(avail.mealIds);

  // Group the available meals by type. `avail.mealIds` is already sorted (by id)
  // for determinism, so each type's list keeps that stable order.
  const allowedByType = emptyAllowed();
  for (const id of avail.mealIds) {
    const meal = mealById.get(id);
    if (meal) allowedByType[meal.type].push(meal.id);
  }

  if (avail.menuIds.length === 0) {
    return { policy, primaryMenuId: null, slots: [], swapEnabled, allowedByType };
  }

  // Available menus, newest publish first (ties by id), for base-meal selection.
  const availableMenus = menus
    .filter((m) => avail.menuIds.includes(m.id))
    .sort((a, b) =>
      a.publishDate === b.publishDate
        ? b.id.localeCompare(a.id)
        : b.publishDate.localeCompare(a.publishDate),
    );

  // The primary menu = the base plan source for a SINGLE-menu policy
  // (fixed/rotating → the one active menu). For the union policies
  // (cumulative/full_pool) the base plan spans menus, so we feature the newest
  // menu only for display; base meals are chosen per type below.
  const primaryMenuId =
    policy === "fixed" || policy === "rotating"
      ? avail.menuIds[0]
      : availableMenus[0].id;
  const primaryMenu = menus.find((m) => m.id === primaryMenuId) ?? null;
  const unionPolicy = policy === "cumulative" || policy === "full_pool";

  const slots: DailyPlanSlot[] = [];
  for (const type of MEAL_TYPES) {
    // Base meal for this slot:
    //  - single-menu policy → the active menu's meal of this type.
    //  - union policy → the newest available meal of this type across menus, so
    //    the daily plan is complete even when the latest menu is partial.
    let baseId: string | undefined;
    if (unionPolicy) {
      for (const menu of availableMenus) {
        baseId = menu.mealIds.find((id) => {
          const m = mealById.get(id);
          return m?.type === type && availableIds.has(id);
        });
        if (baseId) break;
      }
    } else {
      baseId = primaryMenu?.mealIds.find((id) => {
        const m = mealById.get(id);
        return m?.type === type && availableIds.has(id);
      });
    }
    const baseMeal = baseId ? mealById.get(baseId) : undefined;
    if (!baseMeal) continue; // no available meal of this type

    // Apply a saved pick when swapping is allowed and it is still a valid,
    // available same-type meal.
    const pickId = picks?.[type];
    const pickMeal =
      swapEnabled &&
      pickId &&
      pickId !== baseMeal.id &&
      allowedByType[type].includes(pickId)
        ? mealById.get(pickId)
        : undefined;
    const shown = pickMeal ?? baseMeal;

    // Swap options: same-type available meals other than the one shown. Empty
    // under `fixed` so the UI has a single, unambiguous signal.
    const alternatives = swapEnabled
      ? allowedByType[type]
          .filter((id) => id !== shown.id)
          .map((id) => mealById.get(id))
          .filter((m): m is Meal => Boolean(m))
      : [];

    slots.push({
      type,
      meal: shown,
      baseMeal,
      picked: Boolean(pickMeal),
      alternatives,
    });
  }

  return { policy, primaryMenuId, slots, swapEnabled, allowedByType };
}

/**
 * Whether `mealId` is a legal pick for `type` under this plan: swap must be
 * enabled and the meal must be in the type's available set. Used to validate a
 * client's chosen swap on the server before persisting it (CLAUDE.md: code
 * enforces the rules, unknown meals are blocked).
 */
export function isAllowedPick(
  plan: DailyPlan,
  type: MealType,
  mealId: string,
): boolean {
  return plan.swapEnabled && (plan.allowedByType[type] ?? []).includes(mealId);
}
