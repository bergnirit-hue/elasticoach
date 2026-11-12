"use client";

import { useState } from "react";
import { saveSteps } from "./actions";
import { SaveStatus, useAutosave } from "./useAutosave";
import { Ring } from "../_components/Ring";

type Props = {
  date: string;
  stepGoal: number;
  initialSteps: number;
};

const card =
  "rounded-card border border-line bg-surface shadow-card p-4 flex flex-col gap-3";

/** Steps. Water lives in WaterPanel and the journal in JournalPanel. */
export function DayTracker({ date, stepGoal, initialSteps }: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const { state, schedule } = useAutosave(500);

  function changeSteps(raw: string) {
    const v = Math.max(0, Number(raw) || 0);
    setSteps(v);
    schedule(() => saveSteps(date, v));
  }

  const stepPct = Math.min(100, Math.round((steps / stepGoal) * 100));

  return (
    <div className={card}>
      <div className="flex items-center gap-4">
        <Ring
          value={steps}
          goal={stepGoal}
          color="var(--good)"
          label={`צעדים: ${stepPct}% מהיעד`}
        >
          <span className="font-display text-base leading-none tabular-nums">
            {steps.toLocaleString("he-IL")}
          </span>
          <span className="mt-0.5 text-[10px] text-ink-soft">צעדים</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">צעדים</h2>
            <span className="text-sm tabular-nums text-ink-soft">
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
            aria-label="צעדים"
            className="rounded-sm border border-line bg-background p-2.5 text-start"
          />
        </div>
      </div>
      <SaveStatus state={state} />
    </div>
  );
}
