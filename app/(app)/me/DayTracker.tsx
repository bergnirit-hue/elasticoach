"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Journal = Record<string, string>;

type Props = {
  userId: string;
  date: string;
  waterGoalMl: number;
  stepGoal: number;
  initial: { water_ml: number; steps: number; journal: Journal };
};

const JOURNAL_SLOTS: { key: string; label: string }[] = [
  { key: "breakfast", label: "בוקר" },
  { key: "lunch", label: "צהריים" },
  { key: "dinner", label: "ערב" },
  { key: "snacks", label: "ביניים" },
  { key: "notes", label: "תחושות, רעב ושובע" },
];

const card =
  "rounded-card border border-line bg-surface shadow-card p-4 flex flex-col gap-3";
const bar = "h-2.5 rounded-pill bg-surface-2 overflow-hidden";
const stepper =
  "rounded-sm border border-line px-3 py-1.5 text-sm hover:bg-surface-2";

export function DayTracker({
  userId,
  date,
  waterGoalMl,
  stepGoal,
  initial,
}: Props) {
  const supabase = createClient();
  const [waterMl, setWaterMl] = useState(initial.water_ml);
  const [steps, setSteps] = useState(initial.steps);
  const [journal, setJournal] = useState<Journal>(initial.journal ?? {});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(next: {
    waterMl?: number;
    steps?: number;
    journal?: Journal;
  }) {
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from("days").upsert({
        user_id: userId,
        date,
        water_ml: next.waterMl ?? waterMl,
        steps: next.steps ?? steps,
        journal: next.journal ?? journal,
        updated_at: new Date().toISOString(),
      });
      setSaved(error ? "idle" : "saved");
    }, 500);
  }

  function changeWater(delta: number) {
    const v = Math.max(0, waterMl + delta);
    setWaterMl(v);
    save({ waterMl: v });
  }

  function changeSteps(raw: string) {
    const v = Math.max(0, Number(raw) || 0);
    setSteps(v);
    save({ steps: v });
  }

  function changeJournal(key: string, value: string) {
    const j = { ...journal, [key]: value };
    setJournal(j);
    save({ journal: j });
  }

  const waterPct = Math.min(100, Math.round((waterMl / waterGoalMl) * 100));
  const stepPct = Math.min(100, Math.round((steps / stepGoal) * 100));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end text-xs opacity-60" aria-live="polite">
        {saved === "saving" ? "שומר…" : saved === "saved" ? "נשמר" : ""}
      </div>

      {/* Water */}
      <div className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">מים</h2>
          <span className="text-sm tabular-nums">
            {(waterMl / 1000).toFixed(2)} / {(waterGoalMl / 1000).toFixed(1)} ליטר
          </span>
        </div>
        <div className={bar}>
          <i
            className="block h-full rounded-pill bg-water"
            style={{ width: `${waterPct}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeWater(-250)}
            className={stepper}
            aria-label="הפחתת כוס"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => changeWater(250)}
            className={stepper}
          >
            + כוס
          </button>
          <button
            type="button"
            onClick={() => changeWater(750)}
            className={stepper}
          >
            + בקבוק
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">צעדים</h2>
          <span className="text-sm tabular-nums opacity-70">
            יעד {stepGoal.toLocaleString("he-IL")}
          </span>
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          dir="ltr"
          value={steps || ""}
          onChange={(e) => changeSteps(e.target.value)}
          placeholder="מהשעון או מהטלפון"
          className="rounded-sm border border-line bg-background p-2.5 text-start"
        />
        <div className={bar}>
          <i
            className="block h-full rounded-pill bg-good"
            style={{ width: `${stepPct}%` }}
          />
        </div>
      </div>

      {/* Eating journal */}
      <div className={card}>
        <h2 className="font-bold">יומן אכילה</h2>
        <p className="text-sm opacity-70">
          כתבי בחופשיות מה אכלת, עם כמויות אם אפשר.
        </p>
        {JOURNAL_SLOTS.map((slot) => (
          <label key={slot.key} className="flex flex-col gap-1 text-sm">
            {slot.label}
            <textarea
              rows={2}
              value={journal[slot.key] ?? ""}
              onChange={(e) => changeJournal(slot.key, e.target.value)}
              className="rounded-sm border border-line bg-background p-2.5 text-start"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
