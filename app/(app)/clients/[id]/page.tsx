import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, hebrewLongDate, isValidYmd, today } from "@/lib/date";
import { MEAL_SLOTS, type Feedback } from "@/lib/feedback";
import { CoachFeedback } from "./CoachFeedback";

const card = "rounded-xl border border-black/10 p-4 flex flex-col gap-3";

type Journal = Record<string, string>;

type Workout = {
  id: string;
  type: string;
  note: string | null;
  scheduled_time: string | null;
  done: boolean;
};

type Measure = {
  date: string;
  weight: number | null;
  body_fat_pct: number | null;
  muscle_pct: number | null;
  circumferences: Record<string, number | string> | null;
};

export default async function ClientDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const date = isValidYmd(sp.d) ? sp.d : today();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Confirm this user actively coaches the requested client (defense in depth —
  // RLS already scopes every query below to linked clients only).
  const { data: link } = await supabase
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user!.id)
    .eq("client_id", id)
    .eq("status", "active")
    .maybeSingle();

  if (!link) notFound();

  const [
    { data: client },
    { data: day },
    { data: workoutRows },
    { data: measureRows },
    { data: feedbackRows },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", id).single(),
    supabase
      .from("days")
      .select("water_ml, steps, journal")
      .eq("user_id", id)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, type, note, scheduled_time, done")
      .eq("user_id", id)
      .eq("scheduled_date", date),
    // Measurements are weekly: show the most recent one on or before this day.
    supabase
      .from("measures")
      .select("date, weight, body_fat_pct, muscle_pct, circumferences")
      .eq("user_id", id)
      .lte("date", date)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("coach_feedback")
      .select("id, coach_id, client_id, date, meal_key, body")
      .eq("coach_id", user!.id)
      .eq("client_id", id)
      .eq("date", date)
      .order("created_at", { ascending: false }),
  ]);

  const isToday = date === today();
  const journal = (day?.journal ?? {}) as Journal;
  const workouts = (workoutRows ?? []) as Workout[];
  const measure = (measureRows?.[0] ?? null) as Measure | null;
  const feedback = (feedbackRows ?? []) as Feedback[];
  const journalSlots = MEAL_SLOTS.filter((s) => (journal[s.key] ?? "").trim());

  return (
    <section className="flex flex-col gap-4">
      <Link href="/clients" className="text-sm opacity-70 hover:underline">
        → חזרה למתאמנים
      </Link>
      <h1 className="text-xl font-bold">{client?.display_name ?? "מתאמן/ת"}</h1>

      <div className="flex items-center justify-between">
        {/* RTL: next day on the left, previous day on the right. */}
        <Link
          href={`/clients/${id}?d=${addDays(date, 1)}`}
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
            <Link
              href={`/clients/${id}`}
              className="text-xs opacity-60 hover:underline"
            >
              חזרה להיום
            </Link>
          )}
        </div>
        <Link
          href={`/clients/${id}?d=${addDays(date, -1)}`}
          className="rounded-lg border border-black/15 px-3 py-2"
          aria-label="יום קודם"
        >
          ›
        </Link>
      </div>

      {/* Water + steps */}
      <div className={card}>
        <h2 className="font-bold">מים וצעדים</h2>
        <div className="flex gap-6">
          <div>
            <div className="text-sm opacity-70">מים</div>
            <div className="text-lg font-medium tabular-nums">
              {((day?.water_ml ?? 0) / 1000).toFixed(2)} ליטר
            </div>
          </div>
          <div>
            <div className="text-sm opacity-70">צעדים</div>
            <div className="text-lg font-medium tabular-nums">
              {(day?.steps ?? 0).toLocaleString("he-IL")}
            </div>
          </div>
        </div>
      </div>

      {/* Eating journal (read-only) */}
      <div className={card}>
        <h2 className="font-bold">יומן אכילה</h2>
        {journalSlots.length === 0 ? (
          <p className="text-sm opacity-70">אין דיווח אכילה ליום הזה.</p>
        ) : (
          <dl className="flex flex-col gap-2">
            {journalSlots.map((slot) => (
              <div key={slot.key}>
                <dt className="text-sm opacity-70">{slot.label}</dt>
                <dd className="whitespace-pre-wrap">{journal[slot.key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Workouts (read-only) */}
      <div className={card}>
        <h2 className="font-bold">אימונים</h2>
        {workouts.length === 0 ? (
          <p className="text-sm opacity-70">אין אימון מתוכנן ליום הזה.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {workouts.map((w) => (
              <li
                key={w.id}
                className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                  w.done ? "border-emerald-600 bg-emerald-50" : "border-black/10"
                }`}
              >
                <span
                  className={`h-6 w-6 flex-none rounded-md border-2 text-center font-bold leading-5 ${
                    w.done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-black/30"
                  }`}
                  aria-label={w.done ? "בוצע" : "לא בוצע"}
                >
                  {w.done ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <strong>{w.type}</strong>
                  {w.scheduled_time && (
                    <span className="opacity-60 tabular-nums">
                      {" "}
                      {w.scheduled_time.slice(0, 5)}
                    </span>
                  )}
                  {w.note && <div className="text-sm opacity-70">{w.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Latest measurement (read-only) */}
      <div className={card}>
        <h2 className="font-bold">מדדים אחרונים</h2>
        {!measure ? (
          <p className="text-sm opacity-70">עדיין אין מדידות.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm opacity-70">
              נמדד ב־{hebrewLongDate(measure.date)}
            </p>
            <div className="flex flex-wrap gap-6">
              {measure.weight != null && (
                <div>
                  <div className="text-sm opacity-70">משקל</div>
                  <div className="text-lg font-medium tabular-nums">
                    {measure.weight} ק״ג
                  </div>
                </div>
              )}
              {measure.body_fat_pct != null && (
                <div>
                  <div className="text-sm opacity-70">אחוז שומן</div>
                  <div className="text-lg font-medium tabular-nums">
                    {measure.body_fat_pct}%
                  </div>
                </div>
              )}
              {measure.muscle_pct != null && (
                <div>
                  <div className="text-sm opacity-70">אחוז שריר</div>
                  <div className="text-lg font-medium tabular-nums">
                    {measure.muscle_pct}%
                  </div>
                </div>
              )}
            </div>
            {measure.circumferences &&
              Object.keys(measure.circumferences).length > 0 && (
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {Object.entries(measure.circumferences).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <dt className="opacity-70">{k}</dt>
                      <dd className="tabular-nums">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
          </div>
        )}
      </div>

      <CoachFeedback
        coachId={user!.id}
        clientId={id}
        date={date}
        initial={feedback}
      />
    </section>
  );
}
