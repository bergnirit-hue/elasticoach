"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidYmd } from "@/lib/date";
import { isAllowedPick } from "@/lib/menus/daily";
import { MEAL_TYPES, type MealType } from "@/lib/menus/types";
import { loadDailyPlan } from "./menuData";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function isMealType(t: unknown): t is MealType {
  return typeof t === "string" && (MEAL_TYPES as readonly string[]).includes(t);
}

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Current `menu_picks` for a day as a plain, mutable object. */
function currentPicks(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Persist a cross-menu swap to `days.menu_picks` (EC-13 / spec line 119).
 *
 * The chosen meal is validated server-side against the same availability engine
 * the UI used: it must be an available same-type meal under the client's policy,
 * and the policy must allow swapping at all (never under `fixed`). An out-of-pool
 * meal is rejected — the client is never trusted (CLAUDE.md).
 */
export async function saveMenuPick(
  date: string,
  type: MealType,
  mealId: string,
): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  if (!isMealType(type)) return fail("סוג ארוחה לא תקין");
  if (typeof mealId !== "string" || mealId === "") return fail("מנה לא תקינה");

  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const load = await loadDailyPlan(supabase, user.id, date);
  if (!load.hasCoach) return fail("אין מאמן פעיל");
  if (!isAllowedPick(load.plan, type, mealId)) {
    return fail("המנה הזו לא זמינה להחלפה לפי מדיניות התפריט");
  }

  const { data: dayRow } = await supabase
    .from("days")
    .select("menu_picks")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const picks = currentPicks(dayRow?.menu_picks);
  picks[type] = mealId;

  const { error } = await supabase.from("days").upsert({
    user_id: user.id,
    date,
    menu_picks: picks,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail("השמירה נכשלה");

  revalidatePath("/me");
  return { ok: true };
}

/** Undo a swap for one slot: drop the saved pick so the menu default returns. */
export async function resetMenuPick(
  date: string,
  type: MealType,
): Promise<ActionResult> {
  if (!isValidYmd(date)) return fail("תאריך לא תקין");
  if (!isMealType(type)) return fail("סוג ארוחה לא תקין");

  const { supabase, user } = await session();
  if (!user) return fail("לא מחוברת");

  const { data: dayRow } = await supabase
    .from("days")
    .select("menu_picks")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const picks = currentPicks(dayRow?.menu_picks);
  if (!(type in picks)) return { ok: true }; // nothing to undo
  delete picks[type];

  const { error } = await supabase.from("days").upsert({
    user_id: user.id,
    date,
    menu_picks: picks,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail("השמירה נכשלה");

  revalidatePath("/me");
  return { ok: true };
}
