/**
 * EC-12 — the single source of truth for "which meals are available to client X
 * on date Y". Pure and DB-free so it is fully unit-testable (see
 * tests/menus-availability.test.ts). Callers load the coach's menus + the
 * effective policy from the DB, then ask this function.
 *
 * The four policies (CLAUDE.md > "Menus"):
 *   - fixed      → exactly one menu: the latest one published on/before `date`.
 *   - rotating   → exactly one menu that changes weekly; the published menus are
 *                  cycled, one per 7-day week since the anchor date.
 *   - cumulative → the union of every menu published on/before `date` (the set
 *                  grows each week as new menus are published).
 *   - full_pool  → the union of the whole pool, independent of publish date,
 *                  because the coach releases everything at once.
 *
 * NOTE (ask-don't-invent): cumulative vs full_pool differ only in whether the
 * publish date gates availability. This is our working interpretation of the
 * CLAUDE.md wording ("all published so far" vs "everything published at once")
 * and must be confirmed with Nirit before EC-13 builds the daily UI on top.
 */

import { parse } from "@/lib/date";
import type { MenuPolicy } from "@/lib/menus/types";

/** A menu reduced to what availability needs: its id, publish date and meals. */
export interface AvailabilityMenu {
  id: string;
  /** `YYYY-MM-DD`. */
  publishDate: string;
  /** Ids of the meals in this menu. */
  mealIds: string[];
}

export interface AvailabilityInput {
  policy: MenuPolicy;
  /** All of the coach's menus (any publish date); order does not matter. */
  menus: AvailabilityMenu[];
  /** The client's "today", `YYYY-MM-DD`. */
  date: string;
  /**
   * `rotating` only: the date week 0 of the rotation starts on (`YYYY-MM-DD`).
   * Defaults to the earliest publish date among the published menus.
   */
  rotationAnchor?: string;
}

export interface AvailabilityResult {
  /** Menus that contribute meals on `date`. */
  menuIds: string[];
  /** Distinct meal ids available on `date`, in stable (sorted) order. */
  mealIds: string[];
}

const EMPTY: AvailabilityResult = { menuIds: [], mealIds: [] };

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative if `to` is earlier. */
function daysBetween(from: string, to: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((parse(to).getTime() - parse(from).getTime()) / MS_PER_DAY);
}

/** Published on/before `date`, oldest first, ties broken by id for determinism. */
function publishedUpTo(
  menus: AvailabilityMenu[],
  date: string,
): AvailabilityMenu[] {
  return menus
    .filter((m) => m.publishDate <= date)
    .sort((a, b) =>
      a.publishDate === b.publishDate
        ? a.id.localeCompare(b.id)
        : a.publishDate.localeCompare(b.publishDate),
    );
}

function collect(menus: AvailabilityMenu[]): AvailabilityResult {
  if (menus.length === 0) return EMPTY;
  const mealIds = new Set<string>();
  for (const m of menus) for (const id of m.mealIds) mealIds.add(id);
  return {
    menuIds: menus.map((m) => m.id),
    mealIds: [...mealIds].sort(),
  };
}

/**
 * Resolve the meals available to a client on a given date under a menu policy.
 * Returns an empty result when nothing is available (e.g. a `fixed`/`rotating`/
 * `cumulative` date that precedes every publish date).
 */
export function availableMeals(input: AvailabilityInput): AvailabilityResult {
  const { policy, menus, date } = input;

  switch (policy) {
    case "fixed": {
      const published = publishedUpTo(menus, date);
      // The one fixed menu = the most recently published on/before `date`.
      const current = published[published.length - 1];
      return current ? collect([current]) : EMPTY;
    }

    case "rotating": {
      const published = publishedUpTo(menus, date);
      if (published.length === 0) return EMPTY;
      const anchor = input.rotationAnchor ?? published[0].publishDate;
      const week = Math.floor(daysBetween(anchor, date) / 7);
      // Before the anchor there is no active menu.
      if (week < 0) return EMPTY;
      const current = published[week % published.length];
      return collect([current]);
    }

    case "cumulative":
      // Everything published so far, growing week by week.
      return collect(publishedUpTo(menus, date));

    case "full_pool":
      // The whole pool at once; publish date does not gate availability.
      return collect([...menus].sort((a, b) => a.id.localeCompare(b.id)));

    default: {
      // Exhaustiveness guard: a new policy must be handled above.
      const never: never = policy;
      throw new Error(`Unknown menu policy: ${String(never)}`);
    }
  }
}

/**
 * The effective policy for a client: the per-client override when set, else the
 * coach's default, else the platform default (`fixed`).
 */
export function effectivePolicy(
  coachDefault: MenuPolicy | null | undefined,
  clientOverride: MenuPolicy | null | undefined,
): MenuPolicy {
  return clientOverride ?? coachDefault ?? "fixed";
}
