"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  menuDraftFromForm,
  validateMenuDraft,
  type ValidMenu,
} from "@/lib/menus/builder";
import { loadCoachClients } from "./data";

export interface SaveMenuState {
  error?: string;
}

/** Postgres "column does not exist" — menu.client_id before migration 0010. */
function isMissingClientColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /client_id/.test(error.message ?? "")
  );
}

/**
 * Create or update a coach menu (EC-40). Validates the draft against the
 * coach's own library + client list (pure, in @/lib/menus/builder), inserts any
 * inline-created meals into the library, then writes the menu and its meal
 * links. RLS guarantees a coach can only touch their own rows.
 */
export async function saveMenu(
  _prev: SaveMenuState,
  formData: FormData,
): Promise<SaveMenuState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const coachId = user.id;

  const menuIdRaw = formData.get("menu_id");
  const menuId =
    typeof menuIdRaw === "string" && menuIdRaw !== "" ? menuIdRaw : null;

  // Known meal ids (this coach's library) + active clients, for validation.
  const [{ data: libRows }, clients] = await Promise.all([
    supabase.from("meal_library").select("id").eq("coach_id", coachId),
    loadCoachClients(supabase, coachId),
  ]);
  const knownMealIds = new Set((libRows ?? []).map((r) => r.id as string));
  const clientIds = new Set(clients.map((c) => c.id));

  const draft = menuDraftFromForm(formData);
  const result = validateMenuDraft(draft, { knownMealIds, clientIds });
  if (!result.ok) return { error: result.error };
  const menu: ValidMenu = result.menu;

  // 1. Insert any inline-created meals into the library (idempotent on the
  //    (coach_id, type, text) unique), collecting their ids to link.
  const newMealIds: string[] = [];
  for (const m of menu.newMeals) {
    const { data, error } = await supabase
      .from("meal_library")
      .upsert(
        { coach_id: coachId, type: m.type, text: m.text, recipe_url: m.recipeUrl },
        { onConflict: "coach_id,type,text" },
      )
      .select("id")
      .single();
    if (error || !data) return { error: "שמירת מנה חדשה נכשלה, נסו שוב" };
    newMealIds.push(data.id as string);
  }

  const allMealIds = [...new Set([...menu.selectedMealIds, ...newMealIds])];

  // 2. The menu row. client_id is set only for a single-client menu; it needs
  //    migration 0010. Omitting it entirely keeps the all-clients path working
  //    whether or not 0010 has been applied.
  const menuRow: Record<string, unknown> = {
    coach_id: coachId,
    name: menu.name,
    publish_date: menu.publishDate,
    updated_at: new Date().toISOString(),
  };
  if (menu.appliesTo.kind === "client") {
    menuRow.client_id = menu.appliesTo.clientId;
  }

  let savedMenuId = menuId;
  if (menuId) {
    const { error } = await supabase
      .from("menu")
      .update(menuRow)
      .eq("id", menuId)
      .eq("coach_id", coachId);
    if (error) return menuWriteError(error);
  } else {
    const { data, error } = await supabase
      .from("menu")
      .insert(menuRow)
      .select("id")
      .single();
    if (error || !data) return menuWriteError(error);
    savedMenuId = data.id as string;
  }

  // 3. Replace the menu's meal links (delete then insert the full set).
  if (savedMenuId) {
    await supabase.from("menu_meal").delete().eq("menu_id", savedMenuId);
    if (allMealIds.length) {
      const { error } = await supabase
        .from("menu_meal")
        .insert(allMealIds.map((meal_id) => ({ menu_id: savedMenuId, meal_id })));
      if (error) return { error: "שמירת המנות בתפריט נכשלה, נסו שוב" };
    }
  }

  revalidatePath("/menus");
  redirect("/menus");
}

function menuWriteError(error: { code?: string; message?: string } | null): SaveMenuState {
  if (error && isMissingClientColumn(error)) {
    return {
      error:
        "האפשרות ״מתאמנת יחידה״ תתאפשר לאחר החלת מיגרציה 0010 (באישור Nirit). בינתיים אפשר לפרסם לכל המתאמנות.",
    };
  }
  // Unique (coach_id, name): a menu with this name already exists.
  if (error?.code === "23505") {
    return { error: "כבר קיים תפריט בשם הזה" };
  }
  return { error: "השמירה נכשלה, נסו שוב" };
}

/** Delete a menu the coach owns. */
export async function deleteMenu(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const menuId = formData.get("menu_id");
  if (typeof menuId !== "string" || menuId === "") return;

  await supabase.from("menu").delete().eq("id", menuId).eq("coach_id", user.id);
  revalidatePath("/menus");
  redirect("/menus");
}
