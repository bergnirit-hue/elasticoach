import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, hebrewLongDate, isValidYmd, today } from "@/lib/date";
import { DayTracker } from "./DayTracker";
import { JournalPanel } from "./JournalPanel";
import { MeasuresPanel } from "./MeasuresPanel";
import { WaterPanel } from "./WaterPanel";
import { WorkoutList } from "./WorkoutList";
import { normalizeJournal } from "./journal";
import { normalizeCircumferences, type Measure } from "./measures";
import { loadDailyPlan } from "./menuData";
import { DailyPlanCard } from "./DailyPlanCard";
import { BEFORE_PHOTOS_BUCKET } from "./photo";

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sp = await searchParams;
  const date = isValidYmd(sp.d) ? sp.d : today();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: settings },
    { data: day },
    { data: workouts },
    { data: measureRows },
    { data: measureForDay },
    planLoad,
  ] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
      supabase
        .from("user_settings")
        .select("water_goal_ml, step_goal, goal_title, start_weight, goal_weight")
        .eq("user_id", user!.id)
        .maybeSingle(),
      supabase
        .from("days")
        .select("water_ml, steps, journal")
        .eq("user_id", user!.id)
        .eq("date", date)
        .maybeSingle(),
      supabase
        .from("workouts")
        .select("id, type, note, scheduled_time, done")
        .eq("user_id", user!.id)
        .eq("scheduled_date", date),
      supabase
        .from("measures")
        .select("date, weight, body_fat_pct, muscle_pct, circumferences")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(24),
      supabase
        .from("measures")
        .select("date, weight, body_fat_pct, muscle_pct, circumferences, photo_path")
        .eq("user_id", user!.id)
        .eq("date", date)
        .maybeSingle(),
      loadDailyPlan(supabase, user!.id, date),
    ]);

  type MeasureRow = {
    date: string;
    weight: number | null;
    body_fat_pct: number | null;
    muscle_pct: number | null;
    circumferences: unknown;
  };
  const toMeasure = (m: MeasureRow): Measure => ({
    date: m.date,
    weight: m.weight,
    body_fat_pct: m.body_fat_pct,
    muscle_pct: m.muscle_pct,
    circumferences: normalizeCircumferences(m.circumferences),
  });
  const history = (measureRows ?? []).map(toMeasure);
  // Queried separately so an old date outside the history window still pre-fills.
  const currentMeasure = measureForDay ? toMeasure(measureForDay) : null;

  // Private "before" photo: resolve a short-lived signed URL server-side
  // (bucket is not public). Owner-only — coach access is an open question (EC-7).
  let photoUrl: string | null = null;
  if (measureForDay?.photo_path) {
    const { data: signed } = await supabase.storage
      .from(BEFORE_PHOTOS_BUCKET)
      .createSignedUrl(measureForDay.photo_path, 60 * 60);
    photoUrl = signed?.signedUrl ?? null;
  }

  const isToday = date === today();

  return (
    <section className="flex flex-col gap-4">
      <header>
        <p className="text-sm opacity-70">שלום {profile?.display_name ?? ""}</p>
        <h1 className="text-xl font-bold">{settings?.goal_title ?? "היום שלי"}</h1>
      </header>

      <div className="flex items-center justify-between">
        {/* RTL: the next day sits on the left, the previous day on the right. */}
        <Link
          href={`/me?d=${addDays(date, 1)}`}
          className="rounded-lg border border-black/15 px-3 py-2"
          aria-label="יום הבא"
        >
          ‹
        </Link>
        <div className="text-center">
          <div className="font-medium">
            {isToday ? "היום" : hebrewLongDate(date)}
          </div>
          {!isToday && (
            <Link href="/me" className="text-xs opacity-60 hover:underline">
              חזרה להיום
            </Link>
          )}
        </div>
        <Link
          href={`/me?d=${addDays(date, -1)}`}
          className="rounded-lg border border-black/15 px-3 py-2"
          aria-label="יום קודם"
        >
          ›
        </Link>
      </div>

      <WaterPanel
        key={`water-${date}`}
        date={date}
        goalMl={settings?.water_goal_ml ?? 2000}
        initialMl={day?.water_ml ?? 0}
      />

      <DayTracker
        key={`steps-${date}`}
        date={date}
        stepGoal={settings?.step_goal ?? 8000}
        initialSteps={day?.steps ?? 0}
      />

      <JournalPanel
        key={`journal-${date}`}
        date={date}
        initial={normalizeJournal(day?.journal)}
      />

      <WorkoutList userId={user!.id} date={date} initial={workouts ?? []} />

      <MeasuresPanel
        key={`measures-${date}`}
        date={date}
        current={currentMeasure}
        history={history}
        startWeight={settings?.start_weight ?? null}
        goalWeight={settings?.goal_weight ?? null}
        photoUrl={photoUrl}
      />

      {/* Daily plan + cross-menu swap (EC-13) */}
      {!planLoad.hasCoach ? (
        <div
          style={{ boxShadow: "var(--shadow-card)" }}
          className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
        >
          <h2 className="font-display text-lg">התפריט שלי</h2>
          <p className="text-sm text-ink-soft">
            עדיין אין מאמן שמלווה אותך. ברגע שתתחברי למאמן והוא יפרסם תפריט,
            הוא יופיע כאן.
          </p>
        </div>
      ) : planLoad.plan.slots.length === 0 ? (
        <div
          style={{ boxShadow: "var(--shadow-card)" }}
          className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
        >
          <h2 className="font-display text-lg">התפריט שלי</h2>
          <p className="text-sm text-ink-soft">
            עדיין אין תפריט פעיל ליום הזה. ברגע שהמאמן יפרסם תפריט, הוא יופיע כאן.
          </p>
        </div>
      ) : (
        <DailyPlanCard
          key={`menu-${date}`}
          date={date}
          slots={planLoad.plan.slots}
          swapEnabled={planLoad.plan.swapEnabled}
        />
      )}
    </section>
  );
}
