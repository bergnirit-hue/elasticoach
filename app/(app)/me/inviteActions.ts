"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseInviteAction } from "@/lib/invites";

export type InviteActionState = { ok: boolean; message: string } | null;

/**
 * EC-45 — the client accepts or declines a coach's invite.
 *   accept  → coach_client.status invited -> active (coach gains read access)
 *   decline → the invited row is deleted (frees the slot for a future re-invite)
 *
 * Every query is scoped to the caller's own `invited` row (client_id = auth.uid()
 * and status = 'invited'); RLS (0009) enforces the same, so this is defense in
 * depth. A zero-row result means the invite was not the caller's to act on.
 */
export async function respondToInvite(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  const action = parseInviteAction(formData.get("action"));
  if (!id || !action) {
    return { ok: false, message: "פעולה לא תקינה." };
  }

  if (action === "accept") {
    const { data, error } = await supabase
      .from("coach_client")
      .update({ status: "active" })
      .eq("id", id)
      .eq("client_id", user.id)
      .eq("status", "invited")
      .select("id");

    if (error || !data || data.length === 0) {
      return { ok: false, message: "לא הצלחנו לאשר את ההזמנה. נסי שוב." };
    }
    revalidatePath("/me");
    return {
      ok: true,
      message: "ההזמנה אושרה. מהיום המאמן/ת יכול/ה לראות את המעקב שלך.",
    };
  }

  // decline
  const { data, error } = await supabase
    .from("coach_client")
    .delete()
    .eq("id", id)
    .eq("client_id", user.id)
    .eq("status", "invited")
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: "לא הצלחנו לדחות את ההזמנה. נסי שוב." };
  }
  revalidatePath("/me");
  return { ok: true, message: "ההזמנה נדחתה." };
}
