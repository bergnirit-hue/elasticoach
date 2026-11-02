"use client";

import { useActionState, useEffect, useRef } from "react";
import { linkClient, type LinkState } from "./actions";

export function LinkClientForm() {
  const [state, action, pending] = useActionState<LinkState, FormData>(
    linkClient,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the field after a successful link.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-xl border border-black/10 p-4 flex flex-col gap-3"
    >
      <h2 className="font-bold">שיוך מתאמן/ת חדש/ה</h2>
      <p className="text-sm opacity-70">
        הזיני את האימייל שאיתו נרשמ/ה המתאמן/ת לאפליקציה.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          אימייל
          <input
            type="email"
            name="email"
            required
            dir="ltr"
            placeholder="name@example.com"
            className="rounded-lg border border-black/15 bg-background p-2.5 text-start"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "משייך…" : "שיוך"}
        </button>
      </div>
      {state && (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
