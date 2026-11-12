"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  menuClientId,
  menuDraftFromForm,
  validateMenuDraft,
  type ValidMenu,
} from "@/lib/menus/builder";
import { loadCoachClients } from "./data";
import { isMissingClientColumn } from "./errors";

export interface SaveMenuState {
  error?: string;
}

const SINGLE_CLIENT_NEEDS_MIGRATION =
  "האפשרות ״מתאמנת יחידה״ תתאפשר לאחר החלת מיגרציה 0010 (באישור Nirit). בינתיים אפשר לפרסם לכל המתאמנות.";

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

  // 2. The menu row. client_id is ALWAYS derived (null for all-clients) so that
  //    switching a menu from a single client back to "all" clears the old
  //    scoping. The column only exists once migration 0010 is applied, so
  //    writeMenuRow strips client_id and retries for the all-clients path when
  //    the column is still missing (keeping all-clients working pre-0010), and
  //    returns a guidance error for a single-client menu.
  const isAllClients = menu.appliesTo.kind === "all";
  const menuRow: Record<string, unknown> = {
    coach_id: coachId,
    name: menu.name,
    publish_date: menu.publishDate,
    client_id: menuClientId(menu.appliesTo),
    updated_at: new Date().toISOString(),
  };

  const written = await writeMenuRow(supabase, coachId, menuId, menuRow, isAllClients);
  if ("error" in written) return written.error;
  const savedMenuId = written.id;

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

type Supabase = Awaited<ReturnType<typeof createClient>>;
type PgError = { code?: string; message?: string } | null;

/**
 * Insert (or update) the menu row. When the DB is still missing `menu.client_id`
 * (migration 0010 not applied): for an all-clients menu, retry without
 * client_id so publishing keeps working; for a single-client menu, surface the
 * guidance error. Returns the saved menu id or a ready error state.
 */
async function writeMenuRow(
  supabase: Supabase,
  coachId: string,
  menuId: string | null,
  menuRow: Record<string, unknown>,
  isAllClients: boolean,
): Promise<{ id: string } | { error: SaveMenuState }> {
  const run = async (row: Record<string, unknown>): Promise<{ id?: string; error: PgError }> => {
    if (menuId) {
      const { error } = await supabase
        .from("menu")
        .update(row)
        .eq("id", menuId)
        .eq("coach_id", coachId);
      return { id: menuId, error };
    }
    const { data, error } = await supabase
      .from("menu")
      .insert(row)
      .select("id")
      .single();
    return { id: data?.id as string | undefined, error };
  };

  let { id, error } = await run(menuRow);
  if (error && isMissingClientColumn(error)) {
    if (!isAllClients) return { error: { error: SINGLE_CLIENT_NEEDS_MIGRATION } };
    // All-clients menu on a pre-0010 DB: the column isn't there to set.
    const withoutClient = { ...menuRow };
    delete withoutClient.client_id;
    ({ id, error } = await run(withoutClient));
  }
  if (error || !id) return { error: menuWriteError(error) };
  return { id };
}

function menuWriteError(error: PgError): SaveMenuState {
  // Unique (coach_id, name): a menu with this name already exists. Check this
  // first so a real unique violation is never mistaken for a missing column.
  if (error?.code === "23505") {
    return { error: "כבר קיים תפריט בשם הזה" };
  }
  if (isMissingClientColumn(error)) {
    return { error: SINGLE_CLIENT_NEEDS_MIGRATION };
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
