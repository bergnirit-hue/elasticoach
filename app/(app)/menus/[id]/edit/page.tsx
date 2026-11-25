import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach, type Relationship } from "@/lib/roles";
import { MenuBuilder } from "../../MenuBuilder";
import {
  loadCoachLibrary,
  loadCoachClients,
  loadMenuForEdit,
} from "../../data";
import { deleteMenu } from "../../actions";

export default async function EditMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rels } = await supabase
    .from("coach_client")
    .select("coach_id, client_id, status");
  if (!isCoach((rels ?? []) as Relationship[], user.id)) redirect("/me");

  const [menu, library, clients] = await Promise.all([
    loadMenuForEdit(supabase, user.id, id),
    loadCoachLibrary(supabase, user.id),
    loadCoachClients(supabase, user.id),
  ]);
  if (!menu) notFound();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">עריכת תפריט</h1>
      <MenuBuilder
        menuId={menu.id}
        library={library}
        clients={clients}
        defaults={{
          name: menu.name,
          publishDate: menu.publishDate,
          selectedMealIds: menu.selectedMealIds,
          appliesToClientId: menu.appliesToClientId,
        }}
      />

      <form action={deleteMenu} className="border-t border-line pt-4">
        <input type="hidden" name="menu_id" value={menu.id} />
        <button type="submit" className="text-sm text-danger underline">
          מחיקת התפריט
        </button>
      </form>
    </section>
  );
}
