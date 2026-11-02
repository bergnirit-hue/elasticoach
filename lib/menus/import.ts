/**
 * EC-11 — import of a coach's existing menus into the meal library + menus.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ASK-DON'T-INVENT: the REAL data is the "17 existing menus" from Nirit's   │
 * │ artifact export ("גיבוי מלא (JSON)"), which is NOT in this repo. The JSON │
 * │ shape below (`MenuImport`) is the shape THIS importer expects — once      │
 * │ Nirit provides the export we must either confirm it matches or write a    │
 * │ small adapter into this shape. Do not hand-type the 17 menus. See         │
 * │ lib/menus/sample-menu.ts for one small sample that exercises the schema.  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The parser (`parseMenuImport`) is pure and testable: it de-duplicates meals
 * across menus (so the same meal defined in several menus becomes one library
 * row) and produces an insert plan with stable keys. The writer (`importMenus`)
 * is a thin, idempotent Supabase upsert built on top of the plan.
 */

import type { MealType } from "@/lib/menus/types";
import { MEAL_TYPES } from "@/lib/menus/types";

/** One meal as it appears in the export. */
export interface ImportMeal {
  type: MealType;
  text: string;
  recipeUrl?: string | null;
  proteinG?: number | null;
  carbG?: number | null;
  fatG?: number | null;
}

/** One menu as it appears in the export: a name, a publish date and its meals. */
export interface ImportMenu {
  name: string;
  /** `YYYY-MM-DD`. */
  publishDate: string;
  meals: ImportMeal[];
}

/** Top-level shape of the import file. `version` guards future format changes. */
export interface MenuImport {
  version: 1;
  menus: ImportMenu[];
}

/** A de-duplicated meal in the insert plan, with a stable within-import key. */
export interface PlannedMeal extends ImportMeal {
  /** Stable key derived from (type + normalized text); used to wire links. */
  key: string;
}

export interface PlannedMenu {
  name: string;
  publishDate: string;
  /** Keys into `meals`, in the order the menu listed them (de-duplicated). */
  mealKeys: string[];
}

export interface ImportPlan {
  meals: PlannedMeal[];
  menus: PlannedMenu[];
}

const normalize = (s: string): string => s.trim().replace(/\s+/g, " ");

/** Stable key for a meal so the same meal in two menus collapses to one row. */
export function mealKey(type: MealType, text: string): string {
  return `${type}::${normalize(text).toLowerCase()}`;
}

class ImportError extends Error {}

function assertMeal(meal: ImportMeal, where: string): void {
  if (!MEAL_TYPES.includes(meal.type)) {
    throw new ImportError(`${where}: unknown meal type "${meal.type}"`);
  }
  if (normalize(meal.text ?? "") === "") {
    throw new ImportError(`${where}: meal text is empty`);
  }
}

/**
 * Validate and flatten an import into an insert plan. Pure — no DB access.
 * De-duplicates meals by (type + normalized text); the first occurrence wins
 * for optional fields (recipe/macros). Idempotent: parsing the same input twice
 * yields the same keys, so re-importing upserts rather than duplicates.
 */
export function parseMenuImport(data: MenuImport): ImportPlan {
  if (data?.version !== 1) {
    throw new ImportError(`unsupported import version: ${data?.version}`);
  }
  if (!Array.isArray(data.menus)) {
    throw new ImportError("import is missing a `menus` array");
  }

  const mealsByKey = new Map<string, PlannedMeal>();
  const menus: PlannedMenu[] = [];

  data.menus.forEach((menu, mi) => {
    const where = `menu[${mi}] "${menu.name ?? ""}"`;
    if (normalize(menu.name ?? "") === "") {
      throw new ImportError(`${where}: name is empty`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(menu.publishDate ?? "")) {
      throw new ImportError(`${where}: publishDate must be YYYY-MM-DD`);
    }
    if (!Array.isArray(menu.meals) || menu.meals.length === 0) {
      throw new ImportError(`${where}: has no meals`);
    }

    const mealKeys: string[] = [];
    menu.meals.forEach((meal, mealIdx) => {
      assertMeal(meal, `${where} meal[${mealIdx}]`);
      const key = mealKey(meal.type, meal.text);
      if (!mealsByKey.has(key)) {
        mealsByKey.set(key, {
          key,
          type: meal.type,
          text: normalize(meal.text),
          recipeUrl: meal.recipeUrl ?? null,
          proteinG: meal.proteinG ?? null,
          carbG: meal.carbG ?? null,
          fatG: meal.fatG ?? null,
        });
      }
      if (!mealKeys.includes(key)) mealKeys.push(key);
    });

    menus.push({ name: normalize(menu.name), publishDate: menu.publishDate, mealKeys });
  });

  return { meals: [...mealsByKey.values()], menus };
}

/** Row returned after upserting a meal/menu (just the id and its natural key). */
interface IdRow {
  id: string;
  [key: string]: unknown;
}

interface UpsertResult {
  data: IdRow[] | null;
  error: { message: string } | null;
}

/** Minimal shape of the Supabase client methods this importer uses. */
export interface MinimalSupabase {
  from(table: string): {
    upsert(
      values: Record<string, unknown>[],
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ): { select(columns: string): Promise<UpsertResult> };
  };
}

export interface ImportSummary {
  mealsUpserted: number;
  menusUpserted: number;
  linksUpserted: number;
}

function raise(context: string, error: { message: string } | null): void {
  if (error) throw new ImportError(`${context}: ${error.message}`);
}

/**
 * Idempotently import a coach's menus into meal_library / menu / menu_meal.
 * Meals upsert on (coach_id, type, text), menus on (coach_id, name) — the
 * unique keys declared in migration 0003 — so re-running does not duplicate.
 *
 * Done in three steps because the links need the generated meal + menu ids:
 *   1. upsert meals, map each plan key → db id
 *   2. upsert menus, map each name → db id
 *   3. upsert the menu_meal links
 */
export async function importMenus(
  supabase: MinimalSupabase,
  coachId: string,
  data: MenuImport,
): Promise<ImportSummary> {
  const plan = parseMenuImport(data);

  // 1. Meals.
  const mealRes = await supabase
    .from("meal_library")
    .upsert(
      plan.meals.map((m) => ({
        coach_id: coachId,
        type: m.type,
        text: m.text,
        recipe_url: m.recipeUrl,
        protein_g: m.proteinG,
        carb_g: m.carbG,
        fat_g: m.fatG,
      })),
      { onConflict: "coach_id,type,text" },
    )
    .select("id,type,text");
  raise("meal_library upsert", mealRes.error);

  const idByKey = new Map<string, string>();
  for (const row of mealRes.data ?? []) {
    idByKey.set(mealKey(row.type as MealType, row.text as string), row.id);
  }

  // 2. Menus.
  const menuRes = await supabase
    .from("menu")
    .upsert(
      plan.menus.map((m) => ({
        coach_id: coachId,
        name: m.name,
        publish_date: m.publishDate,
      })),
      { onConflict: "coach_id,name" },
    )
    .select("id,name");
  raise("menu upsert", menuRes.error);

  const menuIdByName = new Map<string, string>();
  for (const row of menuRes.data ?? []) {
    menuIdByName.set(row.name as string, row.id);
  }

  // 3. Links.
  const links: Record<string, unknown>[] = [];
  for (const menu of plan.menus) {
    const menuId = menuIdByName.get(menu.name);
    if (!menuId) throw new ImportError(`menu id missing for "${menu.name}"`);
    for (const key of menu.mealKeys) {
      const mealId = idByKey.get(key);
      if (!mealId) throw new ImportError(`meal id missing for key "${key}"`);
      links.push({ menu_id: menuId, meal_id: mealId });
    }
  }

  if (links.length > 0) {
    const linkRes = await supabase
      .from("menu_meal")
      .upsert(links, { onConflict: "menu_id,meal_id", ignoreDuplicates: true })
      .select("menu_id");
    raise("menu_meal upsert", linkRes.error);
  }

  return {
    mealsUpserted: plan.meals.length,
    menusUpserted: plan.menus.length,
    linksUpserted: links.length,
  };
}
