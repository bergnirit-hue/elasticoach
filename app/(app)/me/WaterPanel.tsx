"use client";

import { useState } from "react";
import { saveWater } from "./actions";
import { WATER_PRESETS, clampWater, waterPercent } from "./water";
import { SaveStatus, useAutosave } from "./useAutosave";

const card = "rounded-xl border border-black/10 p-4 flex flex-col gap-3";
const btn = "rounded-lg border border-black/15 px-3 py-1.5 text-sm";

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
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">מים</h2>
        <span className="text-sm tabular-nums">
          {(ml / 1000).toFixed(2)} / {(goalMl / 1000).toFixed(1)} ליטר
        </span>
      </div>
      <div
        className="h-2.5 rounded-full bg-black/10 overflow-hidden"
        role="progressbar"
        aria-label="התקדמות שתיית מים"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <i
          className="block h-full rounded-full bg-sky-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      {ml >= goalMl && <p className="text-sm">הגעת ליעד המים להיום 🎉</p>}
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
          className="w-24 rounded-lg border border-black/15 bg-background p-1.5 text-start text-sm"
        />
        <button type="button" onClick={addCustom} className={btn}>
          הוספה
        </button>
        <SaveStatus state={state} />
      </div>
    </div>
  );
}
