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
    supabase.from("meal_library").select("id, type, text").eq("coach_id", coachId),
    loadCoachClients(supabase, coachId),
  ]);
  const libraryRows = (libRows ?? []) as {
    id: string;
    type: string;
    text: string;
  }[];
  const knownMealIds = new Set(libraryRows.map((r) => r.id));
  const clientIds = new Set(clients.map((c) => c.id));

  const mealKey = (type: string, text: string) => `${type}\u0000${text}`;
  // Existing library meals keyed by (type, text): an inline "new" meal that
  // matches one is REUSED by id and left untouched — re-inserting it would
  // overwrite the existing row's recipe_url (e.g. with null).
  const existingIdByKey = new Map(
    libraryRows.map((r) => [mealKey(r.type, r.text), r.id]),
  );

  const draft = menuDraftFromForm(formData);
  const result = validateMenuDraft(draft, { knownMealIds, clientIds });
  if (!result.ok) return { error: result.error };
  const menu: ValidMenu = result.menu;

  // 1. Resolve inline-created meals to library ids: reuse an existing meal with
  //    the same (type, text) as-is, and insert only the genuinely new ones.
  const newMealIds: string[] = [];
  if (menu.newMeals.length) {
    // De-dupe identical (type, text) rows the coach typed in this flow.
    const drafted = new Map(
      menu.newMeals.map((m) => [
        mealKey(m.type, m.text),
        { coach_id: coachId, type: m.type, text: m.text, recipe_url: m.recipeUrl },
      ]),
    );

    const toInsert: {
      coach_id: string;
      type: string;
      text: string;
      recipe_url: string | null;
    }[] = [];
    for (const [k, row] of drafted) {
      const existingId = existingIdByKey.get(k);
      if (existingId) newMealIds.push(existingId);
      else toInsert.push(row);
    }

    if (toInsert.length) {
      const { data, error } = await supabase
        .from("meal_library")
        .insert(toInsert)
        .select("id");
      if (error || !data) return { error: "שמירת מנה חדשה נכשלה, נסו שוב" };
      for (const r of data as { id: string }[]) newMealIds.push(r.id);
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
