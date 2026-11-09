import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  DOW_SHORT,
  addDays,
  monthGrid,
  monthLabel,
  parse,
  today,
} from "@/lib/date";
import { currentStreak, longestStreak } from "@/lib/streak";

const pad = (n: number) => String(n).padStart(2, "0");

function parseMonth(m?: string): { year: number; month: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y, month: mo - 1 };
  }
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

const MEDAL_MILESTONES = [3, 7, 14, 30];

function journalHasContent(journal: unknown): boolean {
  if (!journal || typeof journal !== "object") return false;
  return Object.values(journal as Record<string, unknown>).some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);
  const grid = monthGrid(year, month);
  const gridStart = grid[0].date;
  const gridEnd = grid[grid.length - 1].date;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const windowStart = addDays(today(), -120);

  const [{ data: settings }, { data: monthDays }, { data: monthWorkouts }, { data: streakDays }] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select("water_goal_ml")
        .eq("user_id", user!.id)
        .maybeSingle(),
      supabase
        .from("days")
        .select("date, water_ml, journal")
        .eq("user_id", user!.id)
        .gte("date", gridStart)
        .lte("date", gridEnd),
      supabase
        .from("workouts")
        .select("scheduled_date, done")
        .eq("user_id", user!.id)
        .gte("scheduled_date", gridStart)
        .lte("scheduled_date", gridEnd),
      supabase
        .from("days")
        .select("date, water_ml")
        .eq("user_id", user!.id)
        .gte("date", windowStart)
        .lte("date", today()),
    ]);

  const waterGoal = settings?.water_goal_ml ?? 2000;

  const dayMap = new Map(
    (monthDays ?? []).map((d) => [d.date as string, d]),
  );
  const woByDate = new Map<string, { planned: number; done: number }>();
  for (const w of monthWorkouts ?? []) {
    const e = woByDate.get(w.scheduled_date) ?? { planned: 0, done: 0 };
    e.planned++;
    if (w.done) e.done++;
    woByDate.set(w.scheduled_date, e);
  }

  const waterMet = new Set(
    (streakDays ?? [])
      .filter((d) => (d.water_ml ?? 0) >= waterGoal)
      .map((d) => d.date as string),
  );
  const curWater = currentStreak(waterMet, today());
  const bestWater = longestStreak(waterMet, windowStart, today());

  const prevDate = new Date(year, month - 1, 1);
  const nextDate = new Date(year, month + 1, 1);
  const prevM = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextM = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;
  const t = today();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/calendar?m=${nextM}`}
          className="rounded-sm border border-line px-3 py-2 hover:bg-surface-2"
          aria-label="חודש הבא"
        >
          ‹
        </Link>
        <h1 className="text-lg font-bold">{monthLabel(year, month)}</h1>
        <Link
          href={`/calendar?m=${prevM}`}
          className="rounded-sm border border-line px-3 py-2 hover:bg-surface-2"
          aria-label="חודש קודם"
        >
          ›
        </Link>
      </div>

      {/* streak summary */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-card border border-line bg-surface shadow-card p-3 text-center">
          <div className="text-2xl font-bold text-water tabular-nums">
            {curWater}
          </div>
          <div className="text-xs opacity-60">רצף מים נוכחי</div>
        </div>
        <div className="flex-1 rounded-card border border-line bg-surface shadow-card p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{bestWater}</div>
          <div className="text-xs opacity-60">שיא רצף מים</div>
        </div>
      </div>

      {/* month grid */}
      <div className="rounded-card border border-line bg-surface shadow-card p-3">
        <div className="grid grid-cols-7 gap-1">
          {DOW_SHORT.map((d) => (
            <div key={d} className="pb-1 text-center text-xs opacity-60">
              {d}
            </div>
          ))}
          {grid.map((cell) => {
            const d = dayMap.get(cell.date);
            const wo = woByDate.get(cell.date);
            const waterOk = (d?.water_ml ?? 0) >= waterGoal;
            const hasJournal = journalHasContent(d?.journal);
            const isToday = cell.date === t;
            const dayNum = parse(cell.date).getDate();
            return (
              <Link
                key={cell.date}
                href={`/me?d=${cell.date}`}
                className={`flex min-h-14 flex-col gap-0.5 rounded-sm border p-1 ${
                  isToday ? "border-2 border-brand" : "border-line"
                } ${cell.inMonth ? "" : "opacity-35"}`}
              >
                <span className="text-xs font-bold tabular-nums">{dayNum}</span>
                <span className="flex flex-wrap gap-0.5 text-xs leading-none">
                  {waterOk && <span className="text-water">●</span>}
                  {wo && wo.done > 0 && (
                    <span className="text-good">✓</span>
                  )}
                  {wo && wo.done === 0 && wo.planned > 0 && (
                    <span className="text-warning opacity-80">○</span>
                  )}
                  {hasJournal && <span className="opacity-50">✎</span>}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs opacity-60">
          <span>
            <span className="text-water">●</span> מים
          </span>
          <span>
            <span className="text-good">✓</span> אימון בוצע
          </span>
          <span>○ אימון מתוכנן</span>
          <span>✎ יומן</span>
        </div>
      </div>

      {/* medals */}
      <div className="rounded-card border border-line bg-surface shadow-card p-4">
        <h2 className="font-bold">מדליות רצף מים</h2>
        <div className="mt-3 flex gap-3">
          {MEDAL_MILESTONES.map((m) => {
            const on = bestWater >= m;
            return (
              <div key={m} className="flex flex-col items-center gap-1">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold ${
                    on
                      ? "border-transparent bg-gold text-ink"
                      : "border-dashed border-line opacity-50"
                  }`}
                >
                  {m}
                </span>
                <span className="text-xs opacity-60">ימים</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
