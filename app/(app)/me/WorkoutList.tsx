"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "../_components/EmptyState";
import { DumbbellIcon } from "../_components/icons";

type Workout = {
  id: string;
  type: string;
  note: string | null;
  scheduled_time: string | null;
  done: boolean;
};

const card =
  "rounded-card border border-line bg-surface shadow-card p-4 flex flex-col gap-3";

function byTime(a: Workout, b: Workout) {
  return (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "");
}

export function WorkoutList({
  userId,
  date,
  initial,
}: {
  userId: string;
  date: string;
  initial: Workout[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Workout[]>([...initial].sort(byTime));
  const [type, setType] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = type.trim();
    if (!t) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        scheduled_date: date,
        scheduled_time: time || null,
        type: t,
        done: false,
      })
      .select("id, type, note, scheduled_time, done")
      .single();
    setBusy(false);
    if (!error && data) {
      setItems((x) => [...x, data as Workout].sort(byTime));
      setType("");
      setTime("");
    }
  }

  async function toggle(w: Workout) {
    const done = !w.done;
    setItems((x) => x.map((i) => (i.id === w.id ? { ...i, done } : i)));
    await supabase.from("workouts").update({ done }).eq("id", w.id);
  }

  async function remove(w: Workout) {
    setItems((x) => x.filter((i) => i.id !== w.id));
    await supabase.from("workouts").delete().eq("id", w.id);
  }

  return (
    <div className={card}>
      <h2 className="font-bold">אימונים</h2>

      {items.length === 0 ? (
        <EmptyState
          icon={<DumbbellIcon className="h-6 w-6" />}
          title="אין אימון מתוכנן ליום הזה"
          description="אפשר להוסיף אימון למטה."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((w) => (
            <li
              key={w.id}
              className={`flex items-center gap-3 rounded-sm border p-2.5 ${
                w.done ? "border-good bg-good/10" : "border-line"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(w)}
                aria-pressed={w.done}
                aria-label={`סימון ${w.type} כבוצע`}
                className={`h-7 w-7 flex-none rounded-md border-2 font-bold ${
                  w.done
                    ? "border-good bg-good text-white"
                    : "border-line"
                }`}
              >
                {w.done ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <strong>{w.type}</strong>
                {w.scheduled_time && (
                  <span className="opacity-60 tabular-nums"> {w.scheduled_time.slice(0, 5)}</span>
                )}
                {w.note && <div className="text-sm opacity-70">{w.note}</div>}
              </div>
              <button
                type="button"
                onClick={() => remove(w)}
                className="text-sm opacity-60 hover:opacity-100"
                aria-label="הסרה"
              >
                הסרה
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          אימון חדש
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="הליכה, ריצה, חדר כושר, אימון בית…"
            maxLength={80}
            className="rounded-sm border border-line bg-background p-2.5 text-start"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          שעה
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-sm border border-line bg-background p-2.5"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !type.trim()}
          className="btn-brand px-4 py-2.5"
        >
          הוספה
        </button>
      </form>
    </div>
  );
}
