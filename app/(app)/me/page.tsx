import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, hebrewLongDate, isValidYmd, today } from "@/lib/date";
import { DayTracker } from "./DayTracker";

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

  const [{ data: profile }, { data: settings }, { data: day }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
      supabase
        .from("user_settings")
        .select("water_goal_ml, step_goal, goal_title")
        .eq("user_id", user!.id)
        .maybeSingle(),
      supabase
        .from("days")
        .select("water_ml, steps, journal")
        .eq("user_id", user!.id)
        .eq("date", date)
        .maybeSingle(),
    ]);

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

      <DayTracker
        userId={user!.id}
        date={date}
        waterGoalMl={settings?.water_goal_ml ?? 2000}
        stepGoal={settings?.step_goal ?? 8000}
        initial={{
          water_ml: day?.water_ml ?? 0,
          steps: day?.steps ?? 0,
          journal: day?.journal ?? {},
        }}
      />
    </section>
  );
}
