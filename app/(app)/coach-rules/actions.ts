"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseRulesForm } from "@/lib/coach-rules";

export interface SaveRulesState {
  error?: string;
  saved?: boolean;
}

/** Save the coach's default rules, or the override for one client. */
export async function saveCoachRules(
  _prev: SaveRulesState,
  formData: FormData,
): Promise<SaveRulesState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawClient = formData.get("client_id");
  const clientId =
    typeof rawClient === "string" && rawClient !== "" ? rawClient : null;

  const parsed = parseRulesForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  if (clientId) {
    // RLS also enforces this; checking here gives a readable error.
    const { data: link } = await supabase
      .from("coach_client")
      .select("id")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!link) return { error: "המתאמן/ת אינם משויכים אליך" };
  }

  // The default/override uniqueness is enforced by partial unique indexes, which
  // upsert cannot target — so look the row up and update or insert.
  let existing = supabase
    .from("coach_rules")
    .select("id")
    .eq("coach_id", user.id);
  existing = clientId
    ? existing.eq("client_id", clientId)
    : existing.is("client_id", null);
  const { data: row, error: lookupError } = await existing.maybeSingle();
  if (lookupError) return { error: "השמירה נכשלה, נסו שוב" };

  const values = { ...parsed.fields, updated_at: new Date().toISOString() };
  const { error } = row
    ? await supabase.from("coach_rules").update(values).eq("id", row.id)
    : await supabase
        .from("coach_rules")
        .insert({ ...values, coach_id: user.id, client_id: clientId });
  if (error) return { error: "השמירה נכשלה, נסו שוב" };

  revalidatePath("/coach-rules");
  return { saved: true };
}

/** Remove a client's override so they fall back to the coach default. */
export async function deleteClientOverride(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clientId = formData.get("client_id");
  if (typeof clientId !== "string" || clientId === "") return;

  await supabase
    .from("coach_rules")
    .delete()
    .eq("coach_id", user.id)
    .eq("client_id", clientId);

  revalidatePath("/coach-rules");
  redirect(`/coach-rules?client=${encodeURIComponent(clientId)}`);
}
