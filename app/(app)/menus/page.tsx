import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach, type Relationship } from "@/lib/roles";
import { hebrewLongDate } from "@/lib/date";
import { loadCoachMenus } from "./data";

export default async function MenusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rels } = await supabase
    .from("coach_client")
    .select("coach_id, client_id, status");
  // Only a coach manages menus; a client has no business on this screen.
  if (!isCoach((rels ?? []) as Relationship[], user.id)) redirect("/me");

  const menus = await loadCoachMenus(supabase, user.id);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">התפריטים שלי</h1>
        <Link
          href="/menus/new"
          className="rounded-pill bg-brand px-4 py-2 text-sm font-medium text-on-brand"
        >
          תפריט חדש
        </Link>
      </div>

      {menus.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-6 text-center">
          <p className="text-ink-soft">עדיין לא יצרת תפריטים.</p>
          <Link href="/menus/new" className="mt-2 inline-block text-brand underline">
            יצירת התפריט הראשון
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {menus.map((m) => (
            <li key={m.id}>
              <Link
                href={`/menus/${m.id}/edit`}
                className="block rounded-card border border-line bg-surface p-4 hover:border-brand"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-sm text-ink-soft">
                    {m.mealCount} מנות
                  </span>
                </div>
                <span className="text-sm text-ink-soft">
                  פרסום: {hebrewLongDate(m.publishDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
