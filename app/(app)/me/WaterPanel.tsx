"use client";

import { useState } from "react";
import { saveWater } from "./actions";
import { WATER_PRESETS, clampWater, waterPercent } from "./water";
import { SaveStatus, useAutosave } from "./useAutosave";
import { Ring } from "../_components/Ring";

const card =
  "rounded-card border border-line bg-surface shadow-card p-4 flex flex-col gap-3";
const btn =
  "rounded-sm border border-line px-3 py-1.5 text-sm hover:bg-surface-2";

export function WaterPanel({
  date,
  goalMl,
  initialMl,
}: {
  date: string;
  goalMl: number;
  initialMl: number;
}) {
  const [ml, setMl] = useState(initialMl);
  const [custom, setCustom] = useState("");
  const { state, schedule } = useAutosave(400);

  function change(delta: number) {
    const v = clampWater(ml + delta);
    setMl(v);
    schedule(() => saveWater(date, v));
  }

  function addCustom() {
    const n = Number(custom);
    if (!Number.isFinite(n) || n <= 0) return;
    change(n);
    setCustom("");
  }

  const pct = waterPercent(ml, goalMl);

  return (
    <div className={card}>
      <div className="flex items-center gap-4">
        <Ring
          value={ml}
          goal={goalMl}
          color="var(--water)"
          label={`מים: ${pct}% מהיעד`}
        >
          <span className="font-display text-lg leading-none tabular-nums">
            {(ml / 1000).toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] text-ink-soft">ליטר</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">מים</h2>
            <span className="text-sm tabular-nums text-ink-soft">
              יעד {(goalMl / 1000).toFixed(1)} ליטר
            </span>
          </div>
          {ml >= goalMl && (
            <p className="text-sm text-good">הגעת ליעד המים להיום 🎉</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => change(-250)}
              className={btn}
              aria-label="הפחתת כוס"
            >
              −
            </button>
            {WATER_PRESETS.map((p) => (
              <button
                key={p.ml}
                type="button"
                onClick={() => change(p.ml)}
                className={btn}
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={50}
              dir="ltr"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder={'מ"ל'}
              aria-label="כמות מים במיליליטרים"
              className="w-24 rounded-sm border border-line bg-background p-1.5 text-start text-sm"
            />
            <button type="button" onClick={addCustom} className={btn}>
              הוספה
            </button>
            <SaveStatus state={state} />
          </div>
        </div>
      </div>
    </div>
  );
}
