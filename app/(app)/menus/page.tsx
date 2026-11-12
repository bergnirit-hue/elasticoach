import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach, type Relationship } from "@/lib/roles";
import { hebrewLongDate } from "@/lib/date";
import { loadCoachMenus } from "./data";
import { EmptyState } from "../_components/EmptyState";
import { PlateIcon } from "../_components/icons";

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
        <Link href="/menus/new" className="btn-brand px-4 py-2 text-sm">
          תפריט חדש
        </Link>
      </div>

      {menus.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-4">
          <EmptyState
            icon={<PlateIcon className="h-6 w-6" />}
            title="עדיין לא יצרת תפריטים"
            description="בנו תפריט מתוך מאגר המנות, בחרו למי הוא חל, ופרסמו אותו למתאמנות."
            action={
              <Link href="/menus/new" className="btn-brand px-4 py-2 text-sm">
                יצירת התפריט הראשון
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {menus.map((m) => (
            <li key={m.id}>
              <Link
                href={`/menus/${m.id}/edit`}
                className="flex items-center gap-3 rounded-card border border-line bg-surface shadow-card p-4 transition-colors hover:border-brand"
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-soft text-brand">
                  <PlateIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-display text-base">
                      {m.name}
                    </span>
                    <span className="flex-none rounded-pill bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-ink-soft">
                      {m.mealCount} מנות
                    </span>
                  </div>
                  <span className="text-sm text-ink-soft">
                    פרסום {hebrewLongDate(m.publishDate)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
