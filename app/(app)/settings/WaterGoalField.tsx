"use client";

import { useState } from "react";

/**
 * Water goal chooser. Most people think in liters ("2 or 3 a day"), but the
 * value is stored in ml (user_settings.water_goal_ml). So we offer liter
 * quick-picks that drive a number-of-ml input; a custom ml value that doesn't
 * match a preset still shows and submits as-is. The number input carries
 * name="water_goal_ml", so saveSettings reads it unchanged.
 */
const PRESETS_L = [1.5, 2, 2.5, 3];

export function WaterGoalField({ defaultMl }: { defaultMl: number }) {
  const [ml, setMl] = useState(defaultMl);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span>יעד מים</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="יעד מים ליום">
        {PRESETS_L.map((liters) => {
          const presetMl = Math.round(liters * 1000);
          const active = ml === presetMl;
          return (
            <button
              key={liters}
              type="button"
              onClick={() => setMl(presetMl)}
              aria-pressed={active}
              className={`rounded-pill border px-3 py-1.5 font-medium transition-colors ${
                active
                  ? "border-transparent bg-brand-soft text-brand"
                  : "border-line hover:bg-surface-2"
              }`}
            >
              {liters} ל׳
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-ink-soft">
        <span className="whitespace-nowrap">או במ״ל:</span>
        <input
          name="water_goal_ml"
          type="number"
          step="50"
          min="0"
          inputMode="numeric"
          value={ml}
          onChange={(e) => setMl(Number(e.target.value) || 0)}
          className="w-28 rounded-sm border border-line bg-background p-2.5 text-start"
        />
      </label>
    </div>
  );
}
