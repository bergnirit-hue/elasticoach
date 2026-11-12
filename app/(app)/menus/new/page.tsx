import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach, type Relationship } from "@/lib/roles";
import { today } from "@/lib/date";
import { MenuBuilder } from "../MenuBuilder";
import { loadCoachLibrary, loadCoachClients } from "../data";

export default async function NewMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rels } = await supabase
    .from("coach_client")
    .select("coach_id, client_id, status");
  if (!isCoach((rels ?? []) as Relationship[], user.id)) redirect("/me");

  const [library, clients] = await Promise.all([
    loadCoachLibrary(supabase, user.id),
    loadCoachClients(supabase, user.id),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">תפריט חדש</h1>
      <MenuBuilder
        menuId={null}
        library={library}
        clients={clients}
        defaults={{
          name: "",
          publishDate: today(),
          selectedMealIds: [],
          appliesToClientId: null,
        }}
      />
    </section>
  );
}
