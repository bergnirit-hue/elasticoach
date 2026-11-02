"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteMeasure, saveMeasure } from "./actions";
import { hebrewLongDate } from "@/lib/date";
import {
  CIRCUMFERENCES,
  weightDeltas,
  type CircumferenceKey,
  type Measure,
} from "./measures";

const card = "rounded-xl border border-black/10 p-4 flex flex-col gap-3";
const field =
  "rounded-lg border border-black/15 bg-background p-2 text-start w-full";

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export function MeasuresPanel({
  date,
  current,
  history,
  startWeight,
  goalWeight,
}: {
  date: string;
  /** The measurement already saved for `date`, if any. */
  current: Measure | null;
  /** Recent measurements, newest first. */
  history: Measure[];
  startWeight: number | null;
  goalWeight: number | null;
}) {
  const [weight, setWeight] = useState(str(current?.weight));
  const [fat, setFat] = useState(str(current?.body_fat_pct));
  const [muscle, setMuscle] = useState(str(current?.muscle_pct));
  const [circ, setCirc] = useState<Partial<Record<CircumferenceKey, string>>>(
    () =>
      Object.fromEntries(
        CIRCUMFERENCES.map(({ key }) => [key, str(current?.circumferences[key])]),
      ),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await saveMeasure({
        date,
        weight,
        bodyFatPct: fat,
        musclePct: muscle,
        circumferences: circ,
      });
      setMessage(res.ok ? { ok: true, text: "נשמר" } : { ok: false, text: res.error });
    });
  }

  function remove(d: string) {
    if (!window.confirm("למחוק את המדידה?")) return;
    startTransition(async () => {
      const res = await deleteMeasure(d);
      if (!res.ok) setMessage({ ok: false, text: res.error });
    });
  }

  const deltas = weightDeltas(history);
  const latestWeight = history.find((m) => m.weight !== null)?.weight ?? null;

  return (
    <div className={card}>
      <h2 className="font-bold">מדידות</h2>

      {goalWeight !== null && (
        <p className="text-sm opacity-70">
          {startWeight !== null && <>התחלה {startWeight} ק״ג · </>}
          {latestWeight !== null && <>עכשיו {latestWeight} ק״ג · </>}
          יעד {goalWeight} ק״ג
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm opacity-70">מדידה ל{hebrewLongDate(date)}</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            משקל (ק״ג)
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            שומן (%)
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            שריר (%)
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
              className={field}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">היקפים (ס״מ)</legend>
          <div className="grid grid-cols-3 gap-2">
            {CIRCUMFERENCES.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                {label}
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={circ[key] ?? ""}
                  onChange={(e) => setCirc({ ...circ, [key]: e.target.value })}
                  className={field}
                />
              </label>
            ))}
          </div>
        </fieldset>

        {/* TODO(EC-17): "before" photo upload — needs a private storage bucket
            (none exists in the migrations yet); `measures.photo_path` is ready. */}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
          >
            שמירת מדידה
          </button>
          {message && (
            <span
              role="status"
              className={`text-sm ${message.ok ? "opacity-70" : "text-red-600"}`}
            >
              {message.text}
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">היסטוריה</h3>
        {history.length === 0 ? (
          <p className="text-sm opacity-70">עדיין אין מדידות.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 text-sm">
            {history.map((m) => {
              const delta = deltas.get(m.date) ?? null;
              const circs = CIRCUMFERENCES.filter(
                ({ key }) => m.circumferences[key] !== undefined,
              )
                .map(({ key, label }) => `${label} ${m.circumferences[key]}`)
                .join(" · ");
              return (
                <li
                  key={m.date}
                  className="flex items-start justify-between gap-2 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <Link href={`/me?d=${m.date}`} className="font-medium hover:underline">
                      {hebrewLongDate(m.date)}
                    </Link>
                    <span className="opacity-80 tabular-nums">
                      {[
                        m.weight !== null && `${m.weight} ק״ג`,
                        m.body_fat_pct !== null && `שומן ${m.body_fat_pct}%`,
                        m.muscle_pct !== null && `שריר ${m.muscle_pct}%`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {delta !== null && delta !== 0 && (
                        <span dir="ltr" className="ms-2 opacity-70">
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </span>
                    {circs && <span className="opacity-60">{circs}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(m.date)}
                    disabled={pending}
                    className="rounded-lg border border-black/15 px-2 py-1 text-xs"
                    aria-label={`מחיקת המדידה מ${hebrewLongDate(m.date)}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
