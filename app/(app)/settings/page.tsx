import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";
import { SaveButton } from "./SaveButton";
import { WaterGoalField } from "./WaterGoalField";

const field = "flex flex-col gap-1 text-sm";
const input =
  "rounded-sm border border-line bg-background p-2.5 text-start";
const card =
  "rounded-card border border-line bg-surface shadow-card p-4 flex flex-col gap-3";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">הגדרות</h1>
        <p className="text-sm text-ink-soft">
          הערכים האישיים שלך. אפשר לעדכן בכל זמן.
        </p>
      </div>

      <form action={saveSettings} className="flex flex-col gap-4">
        <div className={card}>
          <h2 className="font-bold">פרופיל</h2>
          <label className={field}>
            שם
            <input
              name="display_name"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              className={input}
              placeholder="איך לפנות אליך"
            />
          </label>

          <label className={field}>
            כותרת מטרה (לא חובה)
            <input
              name="goal_title"
              type="text"
              defaultValue={settings?.goal_title ?? ""}
              className={input}
              placeholder='למשל: "הדרך שלי"'
            />
          </label>
        </div>

        <div className={card}>
          <h2 className="font-bold">משקל ומטרה</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={field}>
              משקל התחלתי (ק״ג)
              <input
                name="start_weight"
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue={settings?.start_weight ?? ""}
                className={input}
              />
            </label>
            <label className={field}>
              משקל יעד (ק״ג)
              <input
                name="goal_weight"
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue={settings?.goal_weight ?? ""}
                className={input}
              />
            </label>
          </div>

          <label className={field}>
            תאריך התחלה
            <input
              name="start_date"
              type="date"
              defaultValue={settings?.start_date ?? ""}
              className={input}
            />
          </label>
        </div>

        <div className={card}>
          <h2 className="font-bold">יעדים יומיים</h2>
          <WaterGoalField defaultMl={settings?.water_goal_ml ?? 2000} />
          <div className="grid grid-cols-2 gap-3">
            <label className={field}>
              אימונים בשבוע
              <input
                name="weekly_workout_goal"
                type="number"
                step="1"
                inputMode="numeric"
                defaultValue={settings?.weekly_workout_goal ?? 3}
                className={input}
              />
            </label>
            <label className={field}>
              יעד צעדים
              <input
                name="step_goal"
                type="number"
                step="500"
                inputMode="numeric"
                defaultValue={settings?.step_goal ?? 8000}
                className={input}
              />
            </label>
          </div>
        </div>

        <SaveButton />
      </form>
    </section>
  );
}
