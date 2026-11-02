"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LinkState = { ok: boolean; message: string } | null;

/**
 * EC-38 — link a client by email into coach_client.
 * The email is resolved to an auth user inside the SECURITY DEFINER RPC
 * `link_client_by_email`, which enforces coach_id = auth.uid(). Mutual coaching
 * is just two independent links (A→B and, separately, B→A).
 */
export async function linkClient(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";
  if (!email) {
    return { ok: false, message: "יש להזין כתובת אימייל." };
  }

  const { data, error } = await supabase.rpc("link_client_by_email", {
    p_email: email,
  });

  if (error) {
    return { ok: false, message: "משהו השתבש. נסי שוב." };
  }

  switch (data) {
    case "linked":
      revalidatePath("/clients");
      return { ok: true, message: "המתאמן/ת שויכ/ה בהצלחה." };
    case "already":
      return { ok: true, message: "המתאמן/ת כבר משויכ/ת אלייך." };
    case "self":
      return { ok: false, message: "אי אפשר לשייך את עצמך." };
    case "not_found":
      return {
        ok: false,
        message: "לא נמצא משתמש עם האימייל הזה. ודאי שנרשמ/ה לאפליקציה.",
      };
    default:
      return { ok: false, message: "משהו השתבש. נסי שוב." };
  }
}
