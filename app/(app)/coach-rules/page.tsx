import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_RULES,
  getCoachRuleRows,
  type CoachRuleFields,
} from "@/lib/coach-rules";
import { deleteClientOverride } from "./actions";
import { RulesForm } from "./components/RulesForm";
import { ScopeTabs, type ScopeOption } from "./components/ScopeTabs";

export default async function CoachRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: links } = await supabase
    .from("coach_client")
    .select(
      "client_id, client:profiles!coach_client_client_id_fkey(display_name)",
    )
    .eq("coach_id", user!.id)
    .eq("status", "active");

  const clients = (links ?? []).map((l) => ({
    id: l.client_id as string,
    name:
      (l.client as unknown as { display_name: string | null } | null)
        ?.display_name ?? "מתאמן/ת",
  }));

  // Only an actively linked client can be selected; anything else = default.
  const active = clients.find((c) => c.id === client) ?? null;
  const rows = await getCoachRuleRows(supabase, user!.id, active?.id);
  const defaults = rows.find((r) => r.client_id === null) ?? null;
  const override = active
    ? (rows.find((r) => r.client_id === active.id) ?? null)
    : null;

  const options: ScopeOption[] = [
    { clientId: null, label: "ברירת מחדל" },
    ...clients.map((c) => ({ clientId: c.id, label: c.name })),
  ];

  const pick = (r: CoachRuleFields | null): CoachRuleFields => ({
    ...EMPTY_RULES,
    ...(r && {
      allowed_meal_types: r.allowed_meal_types,
      forbidden_meal_tags: r.forbidden_meal_tags,
      water_goal_ml: r.water_goal_ml,
      protein_goal_g: r.protein_goal_g,
      weekly_workout_goal: r.weekly_workout_goal,
      notes: r.notes,
    }),
  });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">כללי המאמן</h1>
        <p className="text-sm opacity-70">
          כללים מובנים שהמערכת אוכפת. אפשר להגדיר ברירת מחדל, ולעקוף אותה לכל
          מתאמן/ת בנפרד.
        </p>
      </div>

      <ScopeTabs options={options} activeClientId={active?.id ?? null} />

      {active && (
        <h2 className="text-lg font-semibold">עקיפה עבור {active.name}</h2>
      )}

      {/* key remounts the form (resets defaultValue) when the scope changes. */}
      <RulesForm
        key={active?.id ?? "default"}
        clientId={active?.id ?? null}
        values={pick(active ? override : defaults)}
        inherited={active ? pick(defaults) : null}
      />

      {active && override && (
        <form action={deleteClientOverride}>
          <input type="hidden" name="client_id" value={active.id} />
          <button type="submit" className="text-sm text-red-700 underline">
            מחיקת העקיפה (חזרה לברירת המחדל)
          </button>
        </form>
      )}
    </section>
  );
}
