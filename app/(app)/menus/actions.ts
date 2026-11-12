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
  // Match the schema-cache / undefined-column codes, and only a message that is
  // specifically about the client_id column being absent — not any message that
  // merely mentions client_id.
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /client_id/.test(error.message ?? "") && /column|does not exist|schema cache/i.test(error.message ?? "");
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

  // 1. Insert any inline-created meals into the library in ONE upsert
  //    (idempotent on the (coach_id, type, text) unique), then map each back to
  //    its id by (type, text) so we can link it.
  const newMealIds: string[] = [];
  if (menu.newMeals.length) {
    const key = (type: string, text: string) => `${type}\u0000${text}`;
    // De-dupe identical (type, text) rows so the upsert payload is clean.
    const uniqueRows = new Map(
      menu.newMeals.map((m) => [
        key(m.type, m.text),
        { coach_id: coachId, type: m.type, text: m.text, recipe_url: m.recipeUrl },
      ]),
    );
    const { data, error } = await supabase
      .from("meal_library")
      .upsert([...uniqueRows.values()], { onConflict: "coach_id,type,text" })
      .select("id, type, text");
    if (error || !data) return { error: "שמירת מנה חדשה נכשלה, נסו שוב" };
    const idByKey = new Map(
      (data as { id: string; type: string; text: string }[]).map((r) => [
        key(r.type, r.text),
        r.id,
      ]),
    );
    for (const k of uniqueRows.keys()) {
      const id = idByKey.get(k);
      if (id) newMealIds.push(id);
    }
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

  // 3. Reconcile the menu's meal links WITHOUT a window of zero meals: upsert
  //    the desired set first (idempotent on the PK), then delete the obsolete
  //    ones. The draft always has >=1 meal, so `allMealIds` is never empty.
  if (savedMenuId) {
    const { error: linkError } = await supabase
      .from("menu_meal")
      .upsert(
        allMealIds.map((meal_id) => ({ menu_id: savedMenuId, meal_id })),
        { onConflict: "menu_id,meal_id", ignoreDuplicates: true },
      );
    if (linkError) return { error: "שמירת המנות בתפריט נכשלה, נסו שוב" };

    const keep = allMealIds.map((id) => `"${id}"`).join(",");
    const { error: pruneError } = await supabase
      .from("menu_meal")
      .delete()
      .eq("menu_id", savedMenuId)
      .not("meal_id", "in", `(${keep})`);
    if (pruneError) return { error: "שמירת המנות בתפריט נכשלה, נסו שוב" };
  }

  revalidatePath("/menus");
  redirect("/menus");
}

function menuWriteError(error: { code?: string; message?: string } | null): SaveMenuState {
  // Unique (coach_id, name): a menu with this name already exists. Check this
  // first so a real unique violation is never mistaken for a missing column.
  if (error?.code === "23505") {
    return { error: "כבר קיים תפריט בשם הזה" };
  }
  if (error && isMissingClientColumn(error)) {
    return {
      error:
        "האפשרות ״מתאמנת יחידה״ תתאפשר לאחר החלת מיגרציה 0010 (באישור Nirit). בינתיים אפשר לפרסם לכל המתאמנות.",
    };
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
