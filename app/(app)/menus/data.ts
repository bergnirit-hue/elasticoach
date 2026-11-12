import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Meal, MealType } from "@/lib/menus/types";
import { MEAL_TYPES } from "@/lib/menus/types";

/**
 * Server-side loaders for the coach menu builder (EC-40). All queries are
 * RLS-scoped to the signed-in coach by the `menu_owner` / `meal_library_owner`
 * policies, so passing the coach id is belt-and-suspenders, not the gate.
 */

interface MealRow {
  id: string;
  type: MealType;
  text: string;
  recipe_url: string | null;
}

/** A coach's meal library, grouped by meal type in the canonical order. */
export interface LibraryByType {
  type: MealType;
  meals: Meal[];
}

export async function loadCoachLibrary(
  supabase: SupabaseClient,
  coachId: string,
): Promise<LibraryByType[]> {
  const { data } = await supabase
    .from("meal_library")
    .select("id, type, text, recipe_url")
    .eq("coach_id", coachId)
    .order("type")
    .order("text");

  const byType = new Map<MealType, Meal[]>();
  for (const t of MEAL_TYPES) byType.set(t, []);
  for (const row of (data ?? []) as MealRow[]) {
    byType.get(row.type)?.push({
      id: row.id,
      type: row.type,
      text: row.text,
      recipeUrl: row.recipe_url,
    });
  }
  return MEAL_TYPES.map((type) => ({ type, meals: byType.get(type) ?? [] }));
}

/** A row in the coach's menu list. */
export interface CoachMenuSummary {
  id: string;
  name: string;
  publishDate: string;
  mealCount: number;
}

export async function loadCoachMenus(
  supabase: SupabaseClient,
  coachId: string,
): Promise<CoachMenuSummary[]> {
  const { data } = await supabase
    .from("menu")
    .select("id, name, publish_date, menu_meal(meal_id)")
    .eq("coach_id", coachId)
    .order("publish_date", { ascending: false });

  return ((data ?? []) as {
    id: string;
    name: string;
    publish_date: string;
    menu_meal: { meal_id: string }[] | null;
  }[]).map((m) => ({
    id: m.id,
    name: m.name,
    publishDate: m.publish_date,
    mealCount: m.menu_meal?.length ?? 0,
  }));
}

/** One menu loaded for editing: its fields plus the ids of its meals. */
export interface MenuForEdit {
  id: string;
  name: string;
  publishDate: string;
  /** The targeted client, or null for an all-clients menu. */
  appliesToClientId: string | null;
  selectedMealIds: string[];
}

interface MenuEditRow {
  id: string;
  name: string;
  publish_date: string;
  client_id?: string | null;
  menu_meal: { meal_id: string }[] | null;
}

export async function loadMenuForEdit(
  supabase: SupabaseClient,
  coachId: string,
  menuId: string,
): Promise<MenuForEdit | null> {
  // client_id exists only once migration 0010 is applied. Try to read it; if
  // the column is absent, fall back so the editor still works (all-clients).
  const withClient = await supabase
    .from("menu")
    .select("id, name, publish_date, client_id, menu_meal(meal_id)")
    .eq("coach_id", coachId)
    .eq("id", menuId)
    .maybeSingle();

  let data = withClient.data as MenuEditRow | null;
  if (withClient.error) {
    const fallback = await supabase
      .from("menu")
      .select("id, name, publish_date, menu_meal(meal_id)")
      .eq("coach_id", coachId)
      .eq("id", menuId)
      .maybeSingle();
    data = fallback.data as MenuEditRow | null;
  }

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    publishDate: data.publish_date,
    appliesToClientId: data.client_id ?? null,
    selectedMealIds: (data.menu_meal ?? []).map((l) => l.meal_id),
  };
}

/** Active clients of the coach, for the "applies to" selector. */
export interface CoachClientOption {
  id: string;
  name: string;
}

export async function loadCoachClients(
  supabase: SupabaseClient,
  coachId: string,
): Promise<CoachClientOption[]> {
  const { data } = await supabase
    .from("coach_client")
    .select(
      "client_id, client:profiles!coach_client_client_id_fkey(display_name)",
    )
    .eq("coach_id", coachId)
    .eq("status", "active");

  return (data ?? []).map((l) => ({
    id: l.client_id as string,
    name:
      (l.client as unknown as { display_name: string | null } | null)
        ?.display_name ?? "מתאמן/ת",
  }));
}
