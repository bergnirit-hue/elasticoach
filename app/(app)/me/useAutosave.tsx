"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "./actions";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave: `schedule(fn)` runs the latest `fn` after `delay` ms of
 * quiet; `flush()` runs it right away (e.g. on blur).
 */
export function useAutosave(delay = 600) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => Promise<ActionResult>) | null>(null);

  const run = useCallback(async () => {
    const fn = pending.current;
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!fn) return;
    const res = await fn();
    setState(res.ok ? "saved" : "error");
  }, []);

  const schedule = useCallback(
    (fn: () => Promise<ActionResult>) => {
      pending.current = fn;
      setState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, delay);
    },
    [delay, run],
  );

  // Leaving the page (e.g. switching day) must not drop an unsaved edit.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void pending.current?.();
    },
    [],
  );

  return { state, schedule, flush: run };
}

export function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className="text-xs opacity-60" aria-live="polite">
      {state === "saving"
        ? "שומר…"
        : state === "saved"
          ? "נשמר"
          : state === "error"
            ? "השמירה נכשלה, נסי שוב"
            : ""}
    </span>
  );
}
